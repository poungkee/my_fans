"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const NewsArticle_1 = require("../entities/NewsArticle");
const Category_1 = require("../entities/Category");
const Source_1 = require("../entities/Source");
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'fans_user',
    password: process.env.DB_PASSWORD || 'fans_password',
    database: process.env.DB_DATABASE || 'fans_db',
    synchronize: false, // production에서는 false
    logging: false,
    entities: [NewsArticle_1.NewsArticle, Category_1.Category, Source_1.Source],
    migrations: [],
    subscribers: [],
    extra: {
        connectionLimit: 10,
        client_encoding: 'UTF8',
    },
});
