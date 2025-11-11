from flask import Flask
from flask import send_from_directory, redirect

app = Flask(__name__)

@app.route("/")
def index():
    return redirect("/viewer.html")

@app.route("/viewer.html")
def viewer():
    return send_from_directory(".", "viewer.html")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)