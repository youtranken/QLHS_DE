/**
 * The actor `sub` stamped on system-initiated audit rows — e.g. the Pool
 * auto-return scheduler, which acts in DCC1's stead when no one picks a ticket
 * in time. Never a real user; display layers render it as "Hệ thống".
 */
export const SYSTEM_SUB = 'system'
