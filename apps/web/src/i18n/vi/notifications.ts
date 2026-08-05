/** 2.2 — the Vietnamese one-liner for each notification kind (the canonical
 *  English status is stored; presentation only, AD-13). Looked up via
 *  kindMessage(), never t(). */
export const notificationKinds = {
  Completed: 'Hồ sơ đã hoàn tất',
  Returned: 'Hồ sơ bị trả lại — cần bổ sung',
  Submitted: 'Hồ sơ mới vào Pool, chờ tiếp nhận',
  'Submitted to DCC2': 'Hồ sơ được bàn giao cho DCC2',
  'Submitted to DCC2 (Hardcopy)': 'Bàn giao bản cứng cho DCC2',
  'Submitted to DCC3': 'Hồ sơ được bàn giao cho DCC3',
  // 2.5 escalation ladder
  EscalateWarn: 'Hồ sơ sắp trễ SLA — nên xử lý sớm',
  EscalateOverdue: 'Hồ sơ đã trễ SLA — cần người xử lý',
  EscalateCritical: 'Hồ sơ trễ nặng — đã báo quản trị',
} satisfies Record<string, string>
