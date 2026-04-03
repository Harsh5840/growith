import AWS from 'aws-sdk';
import { HttpError } from '../errors/http-error';

export class S3Adapter {
  private readonly s3: AWS.S3;
  private readonly bucketName: string;

  constructor() {
    const region = process.env.AWS_REGION || 'ap-south-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'growith-kyc-documents';

    if (!accessKeyId || !secretAccessKey) {
      console.warn('AWS credentials not configured. S3 uploads will fail.');
    }

    this.s3 = new AWS.S3({
      region,
      accessKeyId,
      secretAccessKey,
    });
  }

  /**
   * Upload a file buffer to S3
   * @returns The S3 key of the uploaded file
   */
  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    try {
      await this.s3.putObject({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }).promise();

      return key;
    } catch (error: any) {
      console.error('S3 Upload Error:', error.message);
      throw new HttpError(500, 'Failed to upload file to storage');
    }
  }

  /**
   * Generate a presigned URL for viewing a file (valid for 1 hour)
   */
  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      return this.s3.getSignedUrlPromise('getObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiresInSeconds,
      });
    } catch (error: any) {
      console.error('S3 GetSignedUrl Error:', error.message);
      throw new HttpError(500, 'Failed to generate file URL');
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: key,
      }).promise();
    } catch (error: any) {
      console.error('S3 Delete Error:', error.message);
      throw new HttpError(500, 'Failed to delete file from storage');
    }
  }

  /**
   * Generate a unique S3 key for KYC documents
   */
  static generateKycKey(userId: number, documentType: string, side: string, originalName: string): string {
    const ext = originalName.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    return `kyc/${userId}/${documentType}-${side}-${timestamp}.${ext}`;
  }

  static generateWalletPaymentProofKey(userId: number, originalName: string): string {
    const ext = originalName.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    return `wallet-payments/${userId}/payment-proof-${timestamp}.${ext}`;
  }
}
