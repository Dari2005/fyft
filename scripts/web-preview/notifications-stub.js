// Web-preview stand-in for expo-notifications (not available in a browser).
// Every call is a harmless no-op. Used ONLY on web — see metro.config.js.
const denied = { status: 'denied', granted: false, canAskAgain: false };
module.exports = {
  __esModule: true,
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler: () => {},
  setNotificationChannelAsync: async () => null,
  getPermissionsAsync: async () => denied,
  requestPermissionsAsync: async () => denied,
  getExpoPushTokenAsync: async () => ({ data: '' }),
  getAllScheduledNotificationsAsync: async () => [],
  cancelScheduledNotificationAsync: async () => {},
  scheduleNotificationAsync: async () => '',
  getLastNotificationResponse: () => null,
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
};
