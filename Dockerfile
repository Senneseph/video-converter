# Use an official Python runtime as a parent image
FROM nginx:stable-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY ./html /usr/share/nginx/html

EXPOSE 80
# Set the working directory in the container
# WORKDIR /app