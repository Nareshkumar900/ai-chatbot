/**
 * Notifications Controller
 */
const db = require('../config/db');

/**
 * Get all notifications for current user
 */
async function getUserNotifications(req, res) {
  try {
    const userId = req.user.id;

    const notifications = await db.query(`
      SELECT id, type, title, message, is_read, metadata, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 50
    `, [userId]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return res.json({
      success: true,
      unreadCount,
      notifications
    });
  } catch (err) {
    console.error('[Get Notifications Error]:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve notifications.'
    });
  }
}

/**
 * Mark a single notification as read
 */
async function markNotificationAsRead(req, res) {
  try {
    const notifId = req.params.id;
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notifId, req.user.id]);

    return res.json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification.'
    });
  }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsAsRead(req, res) {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);

    return res.json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all as read.'
    });
  }
}

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
