import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.knowledge import Base, Entity, Relationship
from app.schemas.knowledge import EntityCreate, RelationshipCreate
from app.services.knowledge_service import KnowledgeService

DATABASE_URL = "sqlite+aiosqlite:///./heritage.db"

async def init_data():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        service = KnowledgeService(session)
        
        entities_data = [
            EntityCreate(
                name="张三",
                type="inheritor",
                description="景泰蓝技艺传承人",
                region="北京",
                period="现代",
                importance=0.9,
            ),
            EntityCreate(
                name="景泰蓝",
                type="technique",
                description="中国传统工艺，金属胎掐丝珐琅",
                region="北京",
                period="明清",
                importance=0.95,
            ),
            EntityCreate(
                name="掐丝珐琅瓶",
                type="work",
                description="精美的景泰蓝作品",
                region="北京",
                period="现代",
                importance=0.8,
            ),
            EntityCreate(
                name="云纹",
                type="pattern",
                description="传统吉祥纹样",
                region="全国",
                period="古代",
                importance=0.7,
            ),
            EntityCreate(
                name="北京",
                type="region",
                description="中国首都",
                coordinates={"lat": 39.9042, "lng": 116.4074},
                importance=0.85,
            ),
            EntityCreate(
                name="明清时期",
                type="period",
                description="中国历史上的一个时期",
                importance=0.75,
            ),
            EntityCreate(
                name="铜胎",
                type="material",
                description="景泰蓝的主要材料",
                importance=0.6,
            ),
            EntityCreate(
                name="李四",
                type="inheritor",
                description="苏绣技艺传承人",
                region="苏州",
                period="现代",
                importance=0.85,
            ),
            EntityCreate(
                name="苏绣",
                type="technique",
                description="中国四大名绣之一",
                region="苏州",
                period="古代",
                importance=0.9,
            ),
            EntityCreate(
                name="双面绣",
                type="work",
                description="苏绣的代表作",
                region="苏州",
                period="现代",
                importance=0.75,
            ),
            EntityCreate(
                name="苏州",
                type="region",
                description="江苏省地级市",
                coordinates={"lat": 31.2989, "lng": 120.5853},
                importance=0.8,
            ),
            EntityCreate(
                name="丝绸",
                type="material",
                description="苏绣的主要材料",
                importance=0.65,
            ),
        ]

        entities = []
        for entity_data in entities_data:
            try:
                entity = await service.create_entity(entity_data)
                entities.append(entity)
                print(f"Created entity: {entity.name} (ID: {entity.id})")
            except Exception as e:
                print(f"Error creating entity {entity_data.name}: {e}")

        relationships_data = [
            RelationshipCreate(
                source_id=entities[0].id,
                target_id=entities[1].id,
                relation_type="传承",
                weight=1.0,
            ),
            RelationshipCreate(
                source_id=entities[0].id,
                target_id=entities[2].id,
                relation_type="创作",
                weight=0.9,
            ),
            RelationshipCreate(
                source_id=entities[1].id,
                target_id=entities[3].id,
                relation_type="包含",
                weight=0.7,
            ),
            RelationshipCreate(
                source_id=entities[1].id,
                target_id=entities[4].id,
                relation_type="产地",
                weight=0.8,
            ),
            RelationshipCreate(
                source_id=entities[1].id,
                target_id=entities[5].id,
                relation_type="时期",
                weight=0.6,
            ),
            RelationshipCreate(
                source_id=entities[1].id,
                target_id=entities[6].id,
                relation_type="使用",
                weight=0.9,
            ),
            RelationshipCreate(
                source_id=entities[2].id,
                target_id=entities[3].id,
                relation_type="使用",
                weight=0.8,
            ),
            RelationshipCreate(
                source_id=entities[7].id,
                target_id=entities[8].id,
                relation_type="传承",
                weight=1.0,
            ),
            RelationshipCreate(
                source_id=entities[7].id,
                target_id=entities[9].id,
                relation_type="创作",
                weight=0.9,
            ),
            RelationshipCreate(
                source_id=entities[8].id,
                target_id=entities[10].id,
                relation_type="产地",
                weight=0.8,
            ),
            RelationshipCreate(
                source_id=entities[8].id,
                target_id=entities[11].id,
                relation_type="使用",
                weight=0.9,
            ),
            RelationshipCreate(
                source_id=entities[9].id,
                target_id=entities[11].id,
                relation_type="使用",
                weight=0.95,
            ),
        ]

        for rel_data in relationships_data:
            try:
                relationship = await service.create_relationship(rel_data)
                print(f"Created relationship: {relationship.source_id} -> {relationship.target_id} ({relationship.relation_type})")
            except Exception as e:
                print(f"Error creating relationship: {e}")

        print(f"\n示例数据初始化完成！")
        print(f"创建了 {len(entities)} 个实体和 {len(relationships_data)} 个关系")

if __name__ == "__main__":
    asyncio.run(init_data())