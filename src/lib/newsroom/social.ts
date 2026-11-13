/** Client build stub — social/scheduling module not included. */

export type ScheduledChannelRow = {
  id: string;
  content?: string | null;
  platform?: string | null;
  scheduled_at?: string | null;
  status?: string | null;
};

export async function listScheduledChannels(_limit?: number): Promise<ScheduledChannelRow[]> {
  return [];
}
