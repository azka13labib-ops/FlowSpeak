import { NativeScriptConfig } from '@nativescript/core';

export default {
  id:          'com.ngodink.flowspeak',
  appPath:     'app',
  appResourcesPath: 'app/App_Resources',
  android: {
    v8Flags:             '--expose_gc',
    markingMode:         'none',
    codeCache:           true,
    suppressCallJSMethodExceptions: false,
  },
  ios: {
    discardUncaughtJsExceptions: false,
  },
} as NativeScriptConfig;
