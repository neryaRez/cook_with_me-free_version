output "private_media_bucket_name" {
  description = "Private media S3 bucket name."
  value       = aws_s3_bucket.this.id
}

output "private_media_bucket_arn" {
  description = "Private media S3 bucket ARN."
  value       = aws_s3_bucket.this.arn
}
