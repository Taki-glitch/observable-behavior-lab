"""Run the realtime behavior analysis dashboard."""

from server import create_server


HOST = "127.0.0.1"
PORT = 8000


def main():
    """Start the local laboratory dashboard."""
    server = create_server(HOST, PORT)
    print(f"Observable Behavior Lab running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping dashboard server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
