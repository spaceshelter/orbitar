# Tells docker to use the latest Rust official image
FROM rustlang/rust:nightly-buster-slim as builder
WORKDIR /feed
# first create a cached layer with the dependencies
RUN mkdir -p ./src && echo 'fn main() { panic!("Dummy Image Called!") }' > ./src/main.rs
COPY ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml",  "./"]
RUN cargo build --release
RUN rm -rf ./src
# Copy the project files from your machine to the container
COPY ./ ./
# Invalidate Cargo cache
RUN touch -a -m ./src/main.rs
# Build your application for release, inside the container
RUN cargo build --release

FROM debian:buster-slim
COPY --from=builder /feed/target/release/orbitar-index /feed/orbitar-index
WORKDIR /feed
EXPOSE 6767
# Run the binary built inside the container
CMD ["./orbitar-index"]
