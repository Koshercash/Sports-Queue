import { NextApiRequest, NextApiResponse } from 'next';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../utils/mongodb'; // You'll need to create this utility function
import { authMiddleware } from '../../../utils/auth'; // You'll need to create this middleware

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Received request:', req.method, req.url, req.query);

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).end(`Method ${req.method ?? 'Unknown'} Not Allowed`);
  }

  try {
    console.log('Applying auth middleware');
    await new Promise<void>((resolve, reject) => {
      authMiddleware(req, res, (result: unknown) => {
        if (result instanceof Error) {
          console.error('Auth middleware error:', result);
          return reject(result);
        }
        resolve();
      });
    });

    const { id } = req.query;
    const userId = (req as any).userId;
    console.log('After auth middleware:', { id, userId });

    if (!id || Array.isArray(id) || !userId) {
      console.error('Invalid friend ID or user not authenticated:', { id, userId });
      return res.status(400).json({ error: 'Invalid friend ID or user not authenticated' });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('friends').deleteOne({
      user: new ObjectId(userId),
      friend: new ObjectId(id)
    });

    console.log('Delete result:', result);

    if (result.deletedCount > 0) {
      res.status(200).json({ message: 'Friend removed successfully' });
    } else {
      res.status(404).json({ error: 'Friendship not found' });
    }
  } catch (error) {
    console.error('Server error when removing friend:', error);
    res.status(500).json({ error: 'Failed to remove friend', details: error instanceof Error ? error.message : String(error) });
  }
}