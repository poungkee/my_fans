"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsArticle = void 0;
const typeorm_1 = require("typeorm");
const Source_1 = require("./Source");
const Category_1 = require("./Category");
let NewsArticle = class NewsArticle {
};
exports.NewsArticle = NewsArticle;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint' }),
    __metadata("design:type", Number)
], NewsArticle.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500 }),
    __metadata("design:type", String)
], NewsArticle.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], NewsArticle.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, name: 'ai_summary' }),
    __metadata("design:type", String)
], NewsArticle.prototype, "aiSummary", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true, unique: true }),
    __metadata("design:type", String)
], NewsArticle.prototype, "url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 1000, nullable: true, name: 'image_url' }),
    __metadata("design:type", String)
], NewsArticle.prototype, "imageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', name: 'source_id' }),
    __metadata("design:type", Number)
], NewsArticle.prototype, "sourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', name: 'category_id' }),
    __metadata("design:type", Number)
], NewsArticle.prototype, "categoryId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], NewsArticle.prototype, "journalist", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', name: 'pub_date', nullable: true }),
    __metadata("design:type", Date)
], NewsArticle.prototype, "pubDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], NewsArticle.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], NewsArticle.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Source_1.Source),
    (0, typeorm_1.JoinColumn)({ name: 'source_id' }),
    __metadata("design:type", Source_1.Source)
], NewsArticle.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Category_1.Category),
    (0, typeorm_1.JoinColumn)({ name: 'category_id' }),
    __metadata("design:type", Category_1.Category)
], NewsArticle.prototype, "category", void 0);
exports.NewsArticle = NewsArticle = __decorate([
    (0, typeorm_1.Entity)('news_articles')
], NewsArticle);
