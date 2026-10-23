/*
 * FlowSpeak — app/main-page.ts
 * Code-behind for main-page.xml.
 * Wires the loaded event → ViewModel, and bridges tap events from XML.
 */
import { EventData, Page, Application } from '@nativescript/core';
import { MainViewModel }                 from './main-view-model';

let vm: MainViewModel;

export function onPageLoaded(args: EventData): void {
  const page = args.object as Page;

  vm = new MainViewModel();
  page.bindingContext = vm;

  // Android: mic permission is handled inside MainViewModel.startRecording()
  // via TNSRecorder.requestPermission() — no extra work needed here.

  // Prevent back-gesture from destroying the page mid-session
  if (Application.android) {
    Application.android.on('activityBackPressed', (e: any) => {
      if (vm.isRecording || vm.isProcessing) {
        e.cancel = true; // block back while recording or uploading
      }
    });
  }
}

export function onRecordTap(): void {
  vm?.onRecordToggle();
}
