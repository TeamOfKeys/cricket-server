// src/config/mongodb.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');

class MongoManager {
  constructor() {
    this.isConnected = false;
    this.mongoOptions = {
      maxPoolSize: 100,
      minPoolSize: 10,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    };
  }

  async connect() {
    if (this.isConnected) return;

    try {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb+srv://abhilashbadgujarofficial020:Arihi@123@cricketcrash.mqoeezf.mongodb.net/?retryWrites=true&w=majority&appName=cricketcrash",
        this.mongoOptions
      );
      
      this.isConnected = true;
      console.log('Connected to MongoDB');
      
      await this.setupIndexes();
    } catch (err) {
      console.error('MongoDB connection error:', err);
      console.log('Retrying in 5 seconds...');
      setTimeout(() => this.connect(), 5000);
    }
  }

  async setupIndexes() {
    try {
      // Drop existing indexes first (optional, remove if you want to keep existing indexes)
      // await this.dropAllIndexes();

      const indexOperations = [
        {
          collection: 'users',
          operation: async (collection) => {
            await collection.createIndex(
              { username: 1 },
              { 
                unique: true,
                background: true
              }
            );
          }
        },
        {
          collection: 'games',
          operation: async (collection) => {
            await collection.createIndex(
              { roundId: 1 },
              { 
                unique: true,
                background: true
              }
            );
            await collection.createIndex(
              { timestamp: -1 },
              { background: true }
            );
            await collection.createIndex(
              { revealed: 1 },
              { background: true }
            );
          }
        },
        {
          collection: 'bets',
          operation: async (collection) => {
            await collection.createIndex(
              { roundId: 1, userId: 1 },
              { background: true }
            );
            await collection.createIndex(
              { userId: 1, timestamp: -1 },
              { background: true }
            );
          }
        },
        {
          collection: 'transactions',
          operation: async (collection) => {
            await collection.createIndex(
              { userId: 1, timestamp: -1 },
              { background: true }
            );
          }
        }
      ];

      // Execute index operations
      for (const { collection, operation } of indexOperations) {
        try {
          const dbCollection = mongoose.connection.collection(collection);
          await operation(dbCollection);
          logger.info(`Successfully created indexes for ${collection}`);
        } catch (err) {
          // If error is due to index already existing, log and continue
          if (err.code === 85 || err.code === 86) {
            logger.info(`Index already exists for ${collection}: ${err.message}`);
          } else {
            logger.error(`Error creating indexes for ${collection}:`, err);
          }
        }
      }

      logger.info('MongoDB indexes setup completed');
    } catch (err) {
      logger.error('Error setting up indexes:', err);
    }
  }

  // Helper method to drop all indexes (use with caution)
  async dropAllIndexes() {
    const collections = ['users', 'games', 'bets', 'transactions'];
    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.collection(collectionName);
        await collection.dropIndexes();
        logger.info(`Dropped indexes for ${collectionName}`);
      } catch (err) {
        logger.error(`Error dropping indexes for ${collectionName}:`, err);
      }
    }
  }

  getConnection() {
    return mongoose.connection;
  }
}

module.exports = new MongoManager();