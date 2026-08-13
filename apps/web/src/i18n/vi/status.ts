/** VI presentation labels for canonical EN statuses (AD-13: EN is the source).
 *  Keys are the canonical status strings — looked up via statusVi(), never t(). */
export const status = {
  Submitted: 'Chờ tiếp nhận (Pool)',
  'Submitted to VP Andy': 'Chờ Andy ký',
  'Submitted to DCC2': 'Chờ DCC2 nhận',
  'Received by DCC2': 'DCC2 đang xử lý',
  'Submitted to DCC3': 'Chờ DCC3 nhận',
  'Received by DCC3': 'DCC3 đang xử lý',
  'Submitted to Accounting': 'Đã gửi Accounting',
  'Received from ACC': 'Đã nhận về từ Accounting',
  'Submitted to BOP': 'Chờ BOP duyệt',
  'Submitted to DCC2 (Hardcopy)': 'Chờ DCC2 nhận bản cứng',
  Hardcopy: 'Hoàn tất bản cứng',
  'Sent to Accounting': 'Đã chuyển Accounting (đóng)',
  Completed: 'Hoàn tất',
  Returned: 'Bị trả lại',
  'Return-fixing': 'Đang sửa & nộp lại',
  Reopened: 'Mở lại',
  Cancelled: 'Đã hủy',
} satisfies Record<string, string>
