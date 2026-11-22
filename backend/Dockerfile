# Use official lightweight Python 3.11 slim image
FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Copy dependency list first to leverage Docker layer caching
COPY requirements.txt .

# Install dependencies without saving pip download cache
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files into /app (.dockerignore ensures .env and secrets are excluded)
COPY . .

# Expose the default backend port
EXPOSE 8000

# Start the FastAPI backend server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
