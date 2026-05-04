FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Strip Windows CRLF line endings and make executable
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

CMD ["/bin/sh", "start.sh"]
