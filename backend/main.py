from app.main import app
import os
import socket


def _is_port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
            return True
        except OSError:
            return False

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("BACKEND_PORT", "8000"))

    if not _is_port_available(host, port):
        print(
            f"❌ 端口 {port} 已被占用，无法启动后端。\n"
            f"请先停止占用进程后重试，或设置 BACKEND_PORT 使用其他端口。"
        )
        raise SystemExit(1)

    uvicorn.run(app, host=host, port=port)
