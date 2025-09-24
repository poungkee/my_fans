"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Source = exports.Category = exports.NewsArticle = void 0;
// Entity exports for TypeORM - Crawler Service Only
var NewsArticle_1 = require("./NewsArticle");
Object.defineProperty(exports, "NewsArticle", { enumerable: true, get: function () { return NewsArticle_1.NewsArticle; } });
var Category_1 = require("./Category");
Object.defineProperty(exports, "Category", { enumerable: true, get: function () { return Category_1.Category; } });
var Source_1 = require("./Source");
Object.defineProperty(exports, "Source", { enumerable: true, get: function () { return Source_1.Source; } });
