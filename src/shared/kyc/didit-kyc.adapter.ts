import { HttpError } from '../../shared/errors/http-error';

const DIDIT_API_BASE = 'https://verification.didit.me/v3';

export class DiditKycAdapter {
  private static getHeaders() {
    const apiKey = process.env.DIDIT_API_KEY;
    if (!apiKey) {
      throw new HttpError(500, 'DIDIT_API_KEY is not configured in the environment.');
    }
    return {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    };
  }

  public static async createWorkflow(): Promise<string> {
    try {
      const response = await fetch(`${DIDIT_API_BASE}/workflows/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          workflow_label: 'KYC Onboarding',
          workflow_type: 'kyc',
          is_liveness_enabled: true,
          is_face_match_enabled: true,
          face_match_score_decline_threshold: 50,
          max_retry_attempts: 3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data: any = await response.json();
      return data.uuid;
    } catch (error: any) {
      console.error('Didit Workflow Creation Error:', error.message);
      throw new HttpError(500, 'Failed to create KYC Workflow');
    }
  }

  public static async createSession(userId: string): Promise<{ sessionId: string; url: string }> {
    let workflowId = process.env.DIDIT_WORKFLOW_ID;

    if (!workflowId) {
      // For ease of demo/setup, create workflow on the fly and log it
      console.log('DIDIT_WORKFLOW_ID not found. Creating a new workflow...');
      workflowId = await this.createWorkflow();
      console.log(`\nIMPORTANT: New Didit Workflow Created! Add this to your .env file:
DIDIT_WORKFLOW_ID=${workflowId}\n`);
    }

    try {
      const response = await fetch(`${DIDIT_API_BASE}/session/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          workflow_id: workflowId,
          vendor_data: userId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data: any = await response.json();
      return {
        sessionId: data.session_id,
        url: data.url,
      };
    } catch (error: any) {
      console.error('Didit Session Creation Error:', error.message);
      throw new HttpError(500, 'Failed to start KYC session');
    }
  }

  public static async getDecision(sessionId: string): Promise<{ status: string; decisionData: any }> {
    try {
      const response = await fetch(`${DIDIT_API_BASE}/session/${sessionId}/decision/`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data: any = await response.json();
      return {
        status: data.status,
        decisionData: data,
      };
    } catch (error: any) {
      console.error('Didit Decision Error:', error.message);
      throw new HttpError(500, 'Failed to retrieve KYC decision');
    }
  }
}
