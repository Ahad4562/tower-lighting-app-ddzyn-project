package com.towerlightning.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ClassicBluetoothPlugin.class);
        Log.i("ClassicBluetooth", "MainActivity: registered ClassicBluetoothPlugin");
        super.onCreate(savedInstanceState);
    }
}
