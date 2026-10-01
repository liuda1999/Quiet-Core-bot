package ai.quietcore.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class QuietCoreProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", QuietCoreCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", QuietCoreCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", QuietCoreCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", QuietCoreCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", QuietCoreCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", QuietCoreCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", QuietCoreCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", QuietCoreCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", QuietCoreCapability.Canvas.rawValue)
    assertEquals("camera", QuietCoreCapability.Camera.rawValue)
    assertEquals("voiceWake", QuietCoreCapability.VoiceWake.rawValue)
    assertEquals("talk", QuietCoreCapability.Talk.rawValue)
    assertEquals("location", QuietCoreCapability.Location.rawValue)
    assertEquals("sms", QuietCoreCapability.Sms.rawValue)
    assertEquals("device", QuietCoreCapability.Device.rawValue)
    assertEquals("notifications", QuietCoreCapability.Notifications.rawValue)
    assertEquals("system", QuietCoreCapability.System.rawValue)
    assertEquals("photos", QuietCoreCapability.Photos.rawValue)
    assertEquals("contacts", QuietCoreCapability.Contacts.rawValue)
    assertEquals("calendar", QuietCoreCapability.Calendar.rawValue)
    assertEquals("motion", QuietCoreCapability.Motion.rawValue)
    assertEquals("callLog", QuietCoreCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", QuietCoreCameraCommand.List.rawValue)
    assertEquals("camera.snap", QuietCoreCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", QuietCoreCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", QuietCoreNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", QuietCoreNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", QuietCoreDeviceCommand.Status.rawValue)
    assertEquals("device.info", QuietCoreDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", QuietCoreDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", QuietCoreDeviceCommand.Health.rawValue)
    assertEquals("device.apps", QuietCoreDeviceCommand.Apps.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", QuietCoreSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", QuietCorePhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", QuietCoreContactsCommand.Search.rawValue)
    assertEquals("contacts.add", QuietCoreContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", QuietCoreCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", QuietCoreCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", QuietCoreMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", QuietCoreMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", QuietCoreSmsCommand.Send.rawValue)
    assertEquals("sms.search", QuietCoreSmsCommand.Search.rawValue)
  }

  @Test
  fun talkCommandsUseStableStrings() {
    assertEquals("talk.ptt.start", QuietCoreTalkCommand.PttStart.rawValue)
    assertEquals("talk.ptt.stop", QuietCoreTalkCommand.PttStop.rawValue)
    assertEquals("talk.ptt.cancel", QuietCoreTalkCommand.PttCancel.rawValue)
    assertEquals("talk.ptt.once", QuietCoreTalkCommand.PttOnce.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", QuietCoreCallLogCommand.Search.rawValue)
  }
}
