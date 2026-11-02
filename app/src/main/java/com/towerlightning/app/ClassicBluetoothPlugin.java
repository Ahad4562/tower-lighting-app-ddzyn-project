package com.towerlightning.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Classic Bluetooth SPP/RFCOMM client for HC-05 style serial modules (not BLE).
 * All blocking socket work (connect, read, write, close) runs on background threads.
 */
@CapacitorPlugin(
    name = "ClassicBluetooth",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class ClassicBluetoothPlugin extends Plugin {
    private static final String TAG = "ClassicBluetooth";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final long CONNECT_TIMEOUT_MS = 12000;
    private static final int MAX_LINE = 512;

    private final Object lock = new Object();
    private final ExecutorService connectExecutor = Executors.newSingleThreadExecutor(r -> new Thread(r, "bt-connect"));
    private final ExecutorService writeExecutor = Executors.newSingleThreadExecutor(r -> new Thread(r, "bt-write"));
    private final ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor(r -> new Thread(r, "bt-watchdog"));
    private final AtomicBoolean connecting = new AtomicBoolean(false);

    // Guarded by lock. generation changes on every close/connect so stale threads can detect they were superseded.
    private BluetoothSocket socket;
    private OutputStream output;
    private String connectedAddress;
    private BluetoothSocket pendingSocket;
    private long generation = 0;

    @Override
    public void load() {
        Log.i(TAG, "Plugin loaded: ClassicBluetooth (SDK " + Build.VERSION.SDK_INT + ", Classic SPP/RFCOMM, no BLE)");
    }

    private boolean hasPermission() {
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            || getPermissionState("bluetooth") == PermissionState.GRANTED;
        Log.i(TAG, "BLUETOOTH_CONNECT permission " + (granted ? "granted" : "NOT granted")
            + (Build.VERSION.SDK_INT < Build.VERSION_CODES.S ? " (not required below Android 12)" : ""));
        return granted;
    }

    private void fail(PluginCall call, String message) {
        Log.e(TAG, "Rejecting " + call.getMethodName() + ": " + message);
        call.reject(message);
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    private void emitState(boolean connected, String message) {
        Log.i(TAG, "State event: connected=" + connected + " message=" + message);
        JSObject event = new JSObject();
        event.put("connected", connected);
        event.put("message", message);
        notifyListeners("state", event);
    }

    /** Non-prompting status used by the web layer to decide whether an automatic reconnect is possible. */
    @PluginMethod
    public void getStatus(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        JSObject result = new JSObject();
        result.put("available", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        result.put("permissionGranted", hasPermission());
        synchronized (lock) {
            result.put("connected", socket != null);
            result.put("connecting", connecting.get());
            result.put("address", connectedAddress);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        Log.i(TAG, "listPaired called");
        if (!hasPermission()) {
            requestPermissionForAlias("bluetooth", call, "listPermissionCallback");
            return;
        }
        listDevices(call);
    }

    @PermissionCallback
    private void listPermissionCallback(PluginCall call) {
        if (!hasPermission()) {
            fail(call, "Bluetooth permission was denied. Allow 'Nearby devices' for this app in Android settings.");
            return;
        }
        listDevices(call);
    }

    @SuppressLint("MissingPermission")
    private void listDevices(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            fail(call, "This phone has no Bluetooth adapter.");
            return;
        }
        if (!adapter.isEnabled()) {
            fail(call, "Bluetooth is turned off. Turn it on and try again.");
            return;
        }
        try {
            JSArray devices = new JSArray();
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            for (BluetoothDevice device : bonded) {
                JSObject item = new JSObject();
                item.put("name", device.getName());
                item.put("address", device.getAddress());
                devices.put(item);
            }
            JSObject result = new JSObject();
            result.put("devices", devices);
            Log.i(TAG, "listPaired resolved with " + devices.length() + " bonded device(s)");
            call.resolve(result);
        } catch (SecurityException error) {
            fail(call, "Bluetooth permission was denied.");
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        Log.i(TAG, "connect called, address=" + call.getString("address"));
        if (!hasPermission()) {
            requestPermissionForAlias("bluetooth", call, "connectPermissionCallback");
            return;
        }
        startConnect(call);
    }

    @PermissionCallback
    private void connectPermissionCallback(PluginCall call) {
        if (!hasPermission()) {
            fail(call, "Bluetooth permission was denied. Allow 'Nearby devices' for this app in Android settings.");
            return;
        }
        startConnect(call);
    }

    private void startConnect(PluginCall call) {
        final String address = call.getString("address");
        final BluetoothAdapter adapter = adapter();
        if (adapter == null) {
            fail(call, "This phone has no Bluetooth adapter.");
            return;
        }
        if (!adapter.isEnabled()) {
            fail(call, "Bluetooth is turned off. Turn it on and try again.");
            return;
        }
        if (address == null || !BluetoothAdapter.checkBluetoothAddress(address.toUpperCase())) {
            fail(call, "Invalid Bluetooth address.");
            return;
        }
        final String normalized = address.toUpperCase();

        synchronized (lock) {
            if (socket != null && normalized.equals(connectedAddress)) {
                call.resolve();
                return;
            }
        }
        if (!connecting.compareAndSet(false, true)) {
            fail(call, "A connection attempt is already in progress.");
            return;
        }

        closeConnection(true, "Switching device");
        final long myGeneration;
        synchronized (lock) {
            myGeneration = generation;
        }

        connectExecutor.execute(() -> runConnect(call, adapter, normalized, myGeneration));
    }

    @SuppressLint("MissingPermission")
    private void runConnect(PluginCall call, BluetoothAdapter adapter, String address, long myGeneration) {
        BluetoothSocket newSocket = null;
        final AtomicBoolean timedOut = new AtomicBoolean(false);
        ScheduledFuture<?> timeout = null;
        try {
            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
                fail(call, "Device is not paired. Pair it in Android Bluetooth settings first.");
                return;
            }
            // Discovery is never started by this app, so cancelDiscovery() (which needs BLUETOOTH_SCAN) is not required.
            Log.i(TAG, "Creating RFCOMM socket to " + address + " with SPP UUID " + SPP_UUID);
            newSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            final BluetoothSocket attempt = newSocket;
            synchronized (lock) {
                if (generation != myGeneration) {
                    closeQuietly(attempt);
                    fail(call, "Connection cancelled.");
                    return;
                }
                pendingSocket = attempt;
            }
            timeout = watchdog.schedule(() -> {
                timedOut.set(true);
                closeQuietly(attempt);
            }, CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS);

            Log.i(TAG, "Connecting RFCOMM socket (blocking, background thread)...");
            newSocket.connect();
            Log.i(TAG, "RFCOMM socket connected to " + address);
            timeout.cancel(false);

            OutputStream out = newSocket.getOutputStream();
            InputStream in = newSocket.getInputStream();
            synchronized (lock) {
                pendingSocket = null;
                if (generation != myGeneration) {
                    closeQuietly(newSocket);
                    fail(call, "Connection cancelled.");
                    return;
                }
                socket = newSocket;
                output = out;
                connectedAddress = address;
            }
            startReader(in, newSocket, myGeneration);
            emitState(true, "Connected");
            call.resolve();
        } catch (IOException | SecurityException | IllegalArgumentException error) {
            Log.e(TAG, "RFCOMM connect failed for " + address + ": " + error, error);
            if (timeout != null) timeout.cancel(false);
            if (newSocket != null) closeQuietly(newSocket);
            boolean cancelled;
            synchronized (lock) {
                cancelled = generation != myGeneration;
                if (pendingSocket == newSocket) pendingSocket = null;
            }
            if (cancelled) {
                fail(call, "Connection cancelled.");
            } else if (timedOut.get()) {
                fail(call, "Connection timed out. Check the HC-05 is powered and in range.");
            } else if (error instanceof SecurityException) {
                fail(call, "Bluetooth permission was denied.");
            } else {
                fail(call, "Could not connect: " + error.getMessage());
            }
        } finally {
            connecting.set(false);
        }
    }

    private void startReader(final InputStream input, final BluetoothSocket owner, final long myGeneration) {
        Thread reader = new Thread(() -> {
            byte[] buffer = new byte[256];
            StringBuilder line = new StringBuilder();
            try {
                int count;
                while ((count = input.read(buffer)) != -1) {
                    for (int i = 0; i < count; i++) {
                        char c = (char) (buffer[i] & 0xFF);
                        if (c == '\n' || c == '\r') {
                            if (line.length() > 0) {
                                Log.i(TAG, "RX line: " + line);
                                JSObject event = new JSObject();
                                event.put("line", line.toString());
                                notifyListeners("data", event);
                                line.setLength(0);
                            }
                        } else if (line.length() < MAX_LINE) {
                            line.append(c);
                        }
                    }
                }
            } catch (IOException ignored) {
                Log.i(TAG, "Reader stopped: socket closed or link lost");
            }
            boolean current;
            synchronized (lock) {
                current = socket == owner && generation == myGeneration;
            }
            if (current) {
                closeConnection(false, null);
                emitState(false, "Connection lost");
            }
        }, "bt-read");
        reader.setDaemon(true);
        reader.start();
    }

    @PluginMethod
    public void write(PluginCall call) {
        final String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            fail(call, "Nothing to send.");
            return;
        }
        final OutputStream stream;
        final BluetoothSocket owner;
        synchronized (lock) {
            stream = output;
            owner = socket;
        }
        if (stream == null) {
            fail(call, "Not connected.");
            return;
        }
        writeExecutor.execute(() -> {
            try {
                stream.write(data.getBytes(StandardCharsets.US_ASCII));
                stream.flush();
                Log.i(TAG, "TX " + data.length() + " byte(s): " + data.trim());
                call.resolve();
            } catch (IOException error) {
                Log.e(TAG, "Write failed: " + error, error);
                boolean current;
                synchronized (lock) {
                    current = socket == owner;
                }
                if (current) {
                    closeConnection(false, null);
                    emitState(false, "Connection lost");
                }
                fail(call, "Send failed: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        // Cancel any in-flight connect as well as an open link.
        Log.i(TAG, "disconnect called");
        closeConnection(true, "Disconnected");
        call.resolve();
    }

    /** Closes any open or pending socket. Close can block, so callers on the UI thread must not hold the lock around it. */
    private void closeConnection(boolean bumpGeneration, String stateMessage) {
        BluetoothSocket old;
        BluetoothSocket pending;
        boolean wasConnected;
        synchronized (lock) {
            old = socket;
            pending = pendingSocket;
            wasConnected = old != null;
            socket = null;
            output = null;
            connectedAddress = null;
            pendingSocket = null;
            if (bumpGeneration) generation++;
        }
        closeQuietly(old);
        closeQuietly(pending);
        if (wasConnected && stateMessage != null) {
            emitState(false, stateMessage);
        }
    }

    private static void closeQuietly(BluetoothSocket target) {
        if (target == null) return;
        try {
            target.close();
        } catch (IOException ignored) {
            // Already closed.
        }
    }

    @Override
    protected void handleOnDestroy() {
        closeConnection(true, null);
        connectExecutor.shutdownNow();
        writeExecutor.shutdownNow();
        watchdog.shutdownNow();
    }
}
