import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['retail_book']
    users = await db.users.find({}, {'username': 1, 'role': 1, '_id': 0}).to_list(None)
    for u in users:
        print(u)
    await client.close()

asyncio.run(main())
