"""
数据库迁移脚本：添加 MessageRelation 表
用于存储消息中的关系数据

使用方法：
python -m alembic upgrade head
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_message_relations_table'
down_revision = 'previous_revision'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 创建 message_relations 表
    op.create_table(
        'message_relations',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('message_id', sa.String(36), nullable=False),
        sa.Column('source_entity', sa.String(255), nullable=False),
        sa.Column('target_entity', sa.String(255), nullable=False),
        sa.Column('relation_type', sa.String(100), nullable=False),
        sa.Column('confidence', sa.Integer, default=80),
        sa.Column('evidence', sa.Text, nullable=True),
        sa.Column('bidirectional', sa.Boolean, default=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # 添加索引
    op.create_index('ix_message_relations_message_id', 'message_relations', ['message_id'])
    op.create_index('ix_message_relations_source_entity', 'message_relations', ['source_entity'])
    op.create_index('ix_message_relations_target_entity', 'message_relations', ['target_entity'])
    
    # 为 message_entities 表添加新字段
    op.add_column('message_entities', sa.Column('relevance', sa.Integer, default=80, nullable=True))
    op.add_column('message_entities', sa.Column('url', sa.String(1000), nullable=True))
    op.add_column('message_entities', sa.Column('metadata_json', sa.String(2048), nullable=True))


def downgrade() -> None:
    # 删除 message_relations 表
    op.drop_index('ix_message_relations_target_entity', table_name='message_relations')
    op.drop_index('ix_message_relations_source_entity', table_name='message_relations')
    op.drop_index('ix_message_relations_message_id', table_name='message_relations')
    op.drop_table('message_relations')
    
    # 删除 message_entities 表的新字段
    op.drop_column('message_entities', 'metadata_json')
    op.drop_column('message_entities', 'url')
    op.drop_column('message_entities', 'relevance')
