import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '../../../utils/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();

    const users = await db.collection('users').find({}).limit(10).toArray();

    const sanitizedUsers = users.map(user => ({
      id: user._id.toString(),
      name: user.name,
      profilePicture: user.profilePicture
    }));

    res.status(200).json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}