# IronNets processing server
# Stage 1: build LibreDWG from source (provides dwg2dxf for DWG conversion —
# not packaged in Debian trixie or Alpine)
FROM debian:trixie-slim AS libredwg
ARG LIBREDWG_VERSION=0.13.3
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential curl ca-certificates xz-utils python3 \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL "https://ftp.gnu.org/gnu/libredwg/libredwg-${LIBREDWG_VERSION}.tar.xz" \
    | tar -xJ -C /tmp \
    && cd /tmp/libredwg-* \
    && ./configure --disable-bindings --disable-shared --disable-werror \
    && make -j"$(nproc)" \
    && make install-strip

# Stage 2: runtime
FROM python:3.12-slim
COPY --from=libredwg /usr/local/bin/dwg2dxf /usr/local/bin/dwg2dxf

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
