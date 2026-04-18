{ pkgs, ... }:

{
  packages = [
    pkgs.nodejs_22
    pkgs.python312
    pkgs.python312Packages.pip
    pkgs.docker-compose
  ];

  languages.python = {
    enable = true;
    package = pkgs.python312;
    venv.enable = true;
    venv.requirements = ./backend/requirements.txt;
  };

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
  };

  services.mongodb = {
    enable = true;
  };

  env.MONGO_URI = "mongodb://newsapp:changeme@127.0.0.1:27017/news_summary?authSource=admin";

  scripts.dev-backend.exec = ''
    cd backend
    flask --app app run --host 0.0.0.0 --port 5000 --reload
  '';

  scripts.dev-frontend.exec = ''
    cd frontend
    npm install
    npm run dev
  '';

  scripts.dev.exec = ''
    cd frontend && npm install && cd ..
    trap 'kill 0' EXIT
    (cd backend && flask --app app run --host 0.0.0.0 --port 5000 --reload) &
    (cd frontend && npm run dev) &
    wait
  '';

  enterShell = ''
    echo "News Summary Dev Environment"
    echo "  dev            - start everything (backend + frontend, mongo via devenv)"
    echo "  dev-backend    - start Flask backend only"
    echo "  dev-frontend   - start Vite frontend only"
    echo "  docker compose up --build - run everything in Docker"
  '';
}
