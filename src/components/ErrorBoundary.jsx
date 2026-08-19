import React from "react";

// Không có error boundary nào trong app trước đây — bất kỳ lỗi render nào
// (thiếu field trong meta cũ, v.v.) làm sập toàn bộ cây React và để lại
// màn hình trắng, không có thông báo gì. Boundary này chặn lỗi lại, hiện
// thông báo + nút tải lại thay vì trắng màn hình, và log lỗi ra console để
// còn xem được nguyên nhân.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="text-lg font-semibold">Đã có lỗi xảy ra</h1>
            <p className="text-sm text-muted-foreground">
              Trang này gặp lỗi khi hiển thị. Vui lòng tải lại trang. Nếu lỗi lặp lại, hãy chụp lại thông báo bên dưới để báo lỗi.
            </p>
            <pre className="text-[11px] text-left whitespace-pre-wrap rounded-lg border border-border p-3 bg-muted/50 text-muted-foreground overflow-auto max-h-48">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
