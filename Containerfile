FROM scratch as builder
COPY packages/backend/dist/ /extension/dist
COPY packages/backend/package.json /extension/
COPY packages/backend/media/ /extension/media
COPY LICENSE /extension/
COPY packages/backend/icon.png /extension/
COPY README.md /extension/

FROM scratch

LABEL org.opencontainers.image.title="RHDH Local Extension" \
        org.opencontainers.image.description="RHDH Local management extension for Podman Desktop" \
        org.opencontainers.image.vendor="Your Org / Username" \
        io.podman-desktop.api.version=">= 1.12.0"

LABEL org.opencontainers.image.description asdf

COPY --from=builder /extension /extension
