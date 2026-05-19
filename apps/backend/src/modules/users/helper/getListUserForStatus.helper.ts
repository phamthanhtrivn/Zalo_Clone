import { User } from '../schemas/user.schema';
import { Model } from 'mongoose';
import mongoose from 'mongoose';
import { StorageService } from '../../../common/storage/storage.service';
import { FriendStatus } from 'src/common/types/enums/friend-status';

export async function getListUserForStatus(
  userModel: Model<User>,
  friendStaus: FriendStatus,
  storageService: StorageService,
  userId: string,
) {
  const id = new mongoose.Types.ObjectId(userId);
  const users = await userModel.aggregate([
    { $match: { _id: id } },
    {
      $project: {
        friends: {
          $filter: {
            input: '$friends',
            as: 'friend',
            cond: { $eq: ['$$friend.status', friendStaus] },
          },
        },
      },
    },

    { $unwind: '$friends' },
    {
      $addFields: {
        'friends.friendId': {
          $toObjectId: '$friends.friendId',
        },
      },
    },
    {
      $lookup: {
        from: 'users',
        let: { friendId: '$friends.friendId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$_id', '$$friendId'] },
            },
          },
          {
            $match: {
              isBot: { $ne: true },
            },
          },
        ],
        as: 'friendInfo',
      },
    },
    { $unwind: '$friendInfo' },
    {
      $project: {
        _id: 0,
        friendId: '$friendInfo._id',
        name: '$friendInfo.profile.name',
        avatarUrl: '$friendInfo.profile.avatarUrl',
        birthday: '$friendInfo.profile.birthday',
        status: '$friends.status',
      },
    },
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  const newUser = users?.map((item) => ({
    ...item,
    avatarUrl: storageService.signFileUrl(item.avatarUrl),
  }));

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return newUser;
}
