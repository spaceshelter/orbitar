# Tells docker to use the latest Rust official image
FROM rust:slim-buster as builder
WORKDIR /feed
# Copy the project files from your machine to the container
COPY ./ ./
# Build your application for release, inside the container
RUN cargo build --release

FROM debian:buster-slim
COPY --from=builder /feed /feed
WORKDIR /feed
EXPOSE 6767
# Run the binary built inside the container
CMD ["./target/release/orbitar-index"]
