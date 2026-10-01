package ai.quietcore.app.node

import ai.quietcore.app.protocol.QuietCoreCalendarCommand
import ai.quietcore.app.protocol.QuietCoreCallLogCommand
import ai.quietcore.app.protocol.QuietCoreCameraCommand
import ai.quietcore.app.protocol.QuietCoreCapability
import ai.quietcore.app.protocol.QuietCoreContactsCommand
import ai.quietcore.app.protocol.QuietCoreDeviceCommand
import ai.quietcore.app.protocol.QuietCoreLocationCommand
import ai.quietcore.app.protocol.QuietCoreMotionCommand
import ai.quietcore.app.protocol.QuietCoreNotificationsCommand
import ai.quietcore.app.protocol.QuietCorePhotosCommand
import ai.quietcore.app.protocol.QuietCoreSmsCommand
import ai.quietcore.app.protocol.QuietCoreSystemCommand
import ai.quietcore.app.protocol.QuietCoreTalkCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      QuietCoreCapability.Canvas.rawValue,
      QuietCoreCapability.Device.rawValue,
      QuietCoreCapability.Notifications.rawValue,
      QuietCoreCapability.System.rawValue,
      QuietCoreCapability.Talk.rawValue,
      QuietCoreCapability.Contacts.rawValue,
      QuietCoreCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      QuietCoreCapability.Camera.rawValue,
      QuietCoreCapability.Location.rawValue,
      QuietCoreCapability.Sms.rawValue,
      QuietCoreCapability.CallLog.rawValue,
      QuietCoreCapability.VoiceWake.rawValue,
      QuietCoreCapability.Motion.rawValue,
      QuietCoreCapability.Photos.rawValue,
    )

  private val coreCommands =
    setOf(
      QuietCoreDeviceCommand.Status.rawValue,
      QuietCoreDeviceCommand.Info.rawValue,
      QuietCoreDeviceCommand.Permissions.rawValue,
      QuietCoreDeviceCommand.Health.rawValue,
      QuietCoreNotificationsCommand.List.rawValue,
      QuietCoreNotificationsCommand.Actions.rawValue,
      QuietCoreSystemCommand.Notify.rawValue,
      QuietCoreTalkCommand.PttStart.rawValue,
      QuietCoreTalkCommand.PttStop.rawValue,
      QuietCoreTalkCommand.PttCancel.rawValue,
      QuietCoreTalkCommand.PttOnce.rawValue,
      QuietCoreContactsCommand.Search.rawValue,
      QuietCoreContactsCommand.Add.rawValue,
      QuietCoreCalendarCommand.Events.rawValue,
      QuietCoreCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      QuietCoreCameraCommand.Snap.rawValue,
      QuietCoreCameraCommand.Clip.rawValue,
      QuietCoreCameraCommand.List.rawValue,
      QuietCoreLocationCommand.Get.rawValue,
      QuietCoreMotionCommand.Activity.rawValue,
      QuietCoreMotionCommand.Pedometer.rawValue,
      QuietCoreSmsCommand.Send.rawValue,
      QuietCoreSmsCommand.Search.rawValue,
      QuietCoreCallLogCommand.Search.rawValue,
      QuietCorePhotosCommand.Latest.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesDeviceAppsOnlyWhenUserOptedIn() {
    val disabled = InvokeCommandRegistry.advertisedCommands(defaultFlags(installedAppsSharingEnabled = false))
    val enabled = InvokeCommandRegistry.advertisedCommands(defaultFlags(installedAppsSharingEnabled = true))

    assertFalse(disabled.contains(QuietCoreDeviceCommand.Apps.rawValue))
    assertTrue(enabled.contains(QuietCoreDeviceCommand.Apps.rawValue))
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          smsSearchPossible = false,
          callLogAvailable = false,
          photosAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          installedAppsSharingEnabled = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(QuietCoreMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(QuietCoreMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true, smsSearchPossible = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCommands.contains(QuietCoreSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(QuietCoreSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(QuietCoreSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(QuietCoreSmsCommand.Search.rawValue))
    assertTrue(requestableSearchCommands.contains(QuietCoreSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCapabilities.contains(QuietCoreCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(QuietCoreCapability.Sms.rawValue))
    assertFalse(requestableSearchCapabilities.contains(QuietCoreCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(QuietCoreCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(QuietCoreCapability.CallLog.rawValue))
  }

  @Test
  fun advertisedPhotosSurface_respectsFeatureAvailability() {
    val disabledFlags = defaultFlags(photosAvailable = false)
    val enabledFlags = defaultFlags(photosAvailable = true)

    assertFalse(InvokeCommandRegistry.advertisedCapabilities(disabledFlags).contains(QuietCoreCapability.Photos.rawValue))
    assertFalse(InvokeCommandRegistry.advertisedCommands(disabledFlags).contains(QuietCorePhotosCommand.Latest.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCapabilities(enabledFlags).contains(QuietCoreCapability.Photos.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCommands(enabledFlags).contains(QuietCorePhotosCommand.Latest.rawValue))
  }

  @Test
  fun advertisedCapabilities_includesVoiceWakeWithoutAdvertisingCommands() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(voiceWakeEnabled = true))
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(voiceWakeEnabled = true))

    assertTrue(capabilities.contains(QuietCoreCapability.VoiceWake.rawValue))
    assertFalse(commands.any { it.contains("voice", ignoreCase = true) })
  }

  @Test
  fun find_returnsForegroundMetadataForCameraCommands() {
    val list = InvokeCommandRegistry.find(QuietCoreCameraCommand.List.rawValue)
    val location = InvokeCommandRegistry.find(QuietCoreLocationCommand.Get.rawValue)

    assertNotNull(list)
    assertEquals(true, list?.requiresForeground)
    assertNotNull(location)
    assertEquals(false, location?.requiresForeground)
  }

  @Test
  fun find_returnsNullForUnknownCommand() {
    assertNull(InvokeCommandRegistry.find("not.real"))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    photosAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    installedAppsSharingEnabled: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      smsSearchPossible = smsSearchPossible,
      callLogAvailable = callLogAvailable,
      photosAvailable = photosAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      installedAppsSharingEnabled = installedAppsSharingEnabled,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(
    actual: List<String>,
    expected: Set<String>,
  ) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(
    actual: List<String>,
    forbidden: Set<String>,
  ) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
