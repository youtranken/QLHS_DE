/** Login screen, digest toggle, role switcher. */
export const auth = {
  login: {
    title: 'Đăng nhập',
    subtitle: 'Đăng nhập để bắt đầu — nhập email của bạn.',
    emailLabel: 'Email hoặc tài khoản',
    emailPlaceholder: 'ban@pmh.com.vn',
    passwordLabel: 'Mật khẩu',
    signingInAs: 'Đăng nhập với',
    changeEmail: 'đổi',
    continue: 'Tiếp tục',
    checking: 'Đang kiểm tra…',
    signIn: 'Đăng nhập',
    signingIn: 'Đang đăng nhập…',
    footnote: 'Nhập email để đăng nhập qua PMH ID; tài khoản quản trị nội bộ nhập tên tài khoản.',
    probeError: 'Không kiểm tra được tài khoản — thử lại sau.',
    badCredentials: 'Tài khoản hoặc mật khẩu không đúng.',
    tooManyAttempts: 'Sai quá nhiều lần — tạm khóa đăng nhập. Thử lại sau ít phút.',
    accessDenied: 'Tài khoản của bạn không có quyền vào QLHS. Liên hệ quản trị để được cấp nhóm.',
    sessionExpired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    sessionExpiredKeepEditing: 'Phiên đăng nhập đã hết hạn. Hãy lưu lại nội dung đang nhập rồi đăng nhập lại.',
    showPassword: 'Hiện mật khẩu',
    hidePassword: 'Ẩn mật khẩu',
    heroEyebrow: 'Quản lý hồ sơ · Nội bộ',
    heroTitle: 'Theo dõi hồ sơ,',
    heroTitleEm: 'thông suốt từng ga.',
    heroLead:
      'Tiếp nhận → xử lý → phê duyệt → lưu trữ. Một cửa đăng nhập, theo sát tiến độ và SLA của từng hồ sơ.',
  },
  digest: {
    label: 'Nhắc sáng',
    onTitle: 'Đang nhận email nhắc việc lúc 7h30 (chỉ khi có hồ sơ cần chú ý). Bấm để tắt.',
    offTitle: 'Đang tắt email nhắc việc buổi sáng. Bấm để bật.',
    saveErr: 'Không lưu được tuỳ chọn nhắc việc — thử lại.',
  },
  roleSwitcher: {
    aria: 'Chuyển vai',
  },
} as const
