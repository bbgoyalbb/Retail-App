FROM python:3.12-slim

WORKDIR /app

# Build arguments for environment variables
ARG MONGO_URL=mongodb://localhost:27017
ARG DB_NAME=retail_db
ARG CORS_ORIGINS=*
ARG JWT_SECRET_KEY=change-me-in-production
ARG DEBUG=false
ARG ADMIN_API_KEY=
ARG SEED_FILE_PATH=/tmp/retail_book.xlsm

# Environment variables
ENV MONGO_URL=${MONGO_URL}
ENV DB_NAME=${DB_NAME}
ENV CORS_ORIGINS=${CORS_ORIGINS}
ENV JWT_SECRET_KEY=${JWT_SECRET_KEY}
ENV DEBUG=${DEBUG}
ENV ADMIN_API_KEY=${ADMIN_API_KEY}
ENV SEED_FILE_PATH=${SEED_FILE_PATH}
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy backend files
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Final stage
FROM python:3.12-slim
WORKDIR /app

# Build arguments for environment variables
ARG MONGO_URL=mongodb://localhost:27017
ARG DB_NAME=retail_db
ARG CORS_ORIGINS=*
ARG JWT_SECRET_KEY=change-me-in-production
ARG DEBUG=false
ARG ADMIN_API_KEY=
ARG SEED_FILE_PATH=/tmp/retail_book.xlsm

# Environment variables
ENV MONGO_URL=${MONGO_URL}
ENV DB_NAME=${DB_NAME}
ENV CORS_ORIGINS=${CORS_ORIGINS}
ENV JWT_SECRET_KEY=${JWT_SECRET_KEY}
ENV DEBUG=${DEBUG}
ENV ADMIN_API_KEY=${ADMIN_API_KEY}
ENV SEED_FILE_PATH=${SEED_FILE_PATH}
ENV PYTHONUNBUFFERED=1

COPY --from=frontend-builder /app/frontend/build ./frontend/build
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
