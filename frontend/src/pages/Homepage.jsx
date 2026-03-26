import React from 'react';
import { Layout, Menu, Typography, Button, Space, Card, Row, Col, List, Tag } from 'antd';
import { 
  UserOutlined, 
  MessageOutlined, 
  SearchOutlined, 
  PictureOutlined,
  FireOutlined,
  BookOutlined,
  BulbOutlined
} from '@ant-design/icons';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

const Homepage = () => {
  // 导航菜单配置
  const menuItems = [
    { key: 'home', label: '首页' },
    { key: 'qa', label: '智能问答' },
    { key: 'search', label: '知识检索' },
    { key: 'extract', label: '元素提取' },
  ];

  // 模拟数据：最近热门非遗主题
  const hotThemes = ['泉州海丝文化', '景德镇青花瓷', '苏绣技艺', '苗族银饰锻造', '皮影戏艺术'];
  
  // 模拟数据：最新录入资料
  const latestMaterials = [
    '《大明一统志》卷五·高清影印版',
    '2025年最新非遗传承人访谈录',
    '地方志：浙江通志·风俗卷',
    '传统建筑木作榫卯结构图解'
  ];

  // 模拟数据：推荐提问示例
  const promptExamples = [
    '帮我总结一下《永乐大典》中关于陶瓷的记载',
    '提取一张苏绣图片的配色方案和针法特点',
    '福建泉州有哪些与海洋文化相关的非遗？',
    '生成一段介绍皮影戏历史的短文'
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* ================= 1. 顶部导航栏 ================= */}
      <Header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: '#fff', 
        borderBottom: '1px solid #e8e8e8',
        padding: '0 40px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <Title level={4} style={{ margin: '0 40px 0 0', color: '#1890ff', whiteSpace: 'nowrap' }}>
            数字遗产引擎
          </Title>
          <Menu 
            mode="horizontal" 
            defaultSelectedKeys={['home']} 
            items={menuItems} 
            style={{ borderBottom: 'none', flex: 1, minWidth: 400 }} 
          />
        </div>
        <div>
          <Button type="text" icon={<UserOutlined />} size="large">
            用户中心
          </Button>
        </div>
      </Header>

      <Content style={{ padding: '0 40px 60px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        
        {/* ================= 2. 首屏介绍区 ================= */}
        <div style={{ padding: '80px 0 60px', textAlign: 'center' }}>
          <Title level={1} style={{ fontSize: '46px', marginBottom: '24px', letterSpacing: '2px' }}>
            数字遗产引擎
          </Title>
          <Paragraph style={{ fontSize: '20px', color: '#595959', marginBottom: '40px' }}>
            面向地方志与非物质文化的智能检索问答与创意辅助平台
          </Paragraph>
          <Space size="large">
            <Button type="primary" size="large" icon={<MessageOutlined />} style={{ height: '50px', padding: '0 32px', fontSize: '16px', borderRadius: '8px' }}>
              立即体验问答
            </Button>
            <Button size="large" icon={<SearchOutlined />} style={{ height: '50px', padding: '0 32px', fontSize: '16px', borderRadius: '8px' }}>
              进入知识检索
            </Button>
          </Space>
        </div>

        {/* ================= 3. 核心功能展示大卡片区 ================= */}
        <div style={{ marginBottom: '60px' }}>
          <Title level={3} style={{ marginBottom: '24px' }}>平台核心能力</Title>
          <Row gutter={[24, 24]}>
            {[
              { title: '智能问答模块', desc: '基于大模型的文化知识对话辅助', icon: <MessageOutlined /> },
              { title: '知识检索模块', desc: '海量地方志与非遗文献精准检索', icon: <SearchOutlined /> },
              { title: '元素提取模块', desc: '从图文资料中智能提取文化元素', icon: <PictureOutlined /> },
              { title: '创意工坊模块', desc: '辅助文化创意设计与内容生成', icon: <BulbOutlined /> },
            ].map((item, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <Card 
                  hoverable 
                  style={{ borderRadius: '12px', overflow: 'hidden' }}
                  cover={
                    /* 图片占位区 */
                    <div style={{ 
                      height: '180px', 
                      background: '#e6f7ff', 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#1890ff'
                    }}>
                      <PictureOutlined style={{ fontSize: '48px', opacity: 0.5, marginBottom: '12px' }} />
                      <Text style={{ color: '#1890ff', opacity: 0.8 }}>图片占位区 ({item.title})</Text>
                    </div>
                  }
                >
                  <Card.Meta 
                    title={<span style={{ fontSize: '18px' }}>{item.icon} {item.title}</span>} 
                    description={item.desc} 
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* ================= 4. 底部内容推荐区 ================= */}
        <Row gutter={[24, 24]}>
          
          {/* 最近热门非遗主题 */}
          <Col xs={24} md={8}>
            <Card title={<><FireOutlined style={{color: '#ff4d4f'}}/> 最近热门非遗主题</>} bordered={false} style={{ height: '100%', borderRadius: '12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {hotThemes.map((theme, index) => (
                  <Tag key={index} color={index < 3 ? 'volcano' : 'default'} style={{ padding: '4px 10px', fontSize: '14px', borderRadius: '4px' }}>
                    {theme}
                  </Tag>
                ))}
              </div>
            </Card>
          </Col>

          {/* 最新录入资料 */}
          <Col xs={24} md={8}>
            <Card title={<><BookOutlined style={{color: '#1890ff'}}/> 最新录入资料</>} bordered={false} style={{ height: '100%', borderRadius: '12px' }}>
              <List
                size="small"
                split={false}
                dataSource={latestMaterials}
                renderItem={(item) => <List.Item style={{ padding: '8px 0' }}><Text ellipsis>• {item}</Text></List.Item>}
              />
            </Card>
          </Col>

          {/* 推荐提问示例 */}
          <Col xs={24} md={8}>
            <Card title={<><MessageOutlined style={{color: '#52c41a'}}/> 推荐提问示例</>} bordered={false} style={{ height: '100%', borderRadius: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {promptExamples.map((prompt, index) => (
                  <div key={index} style={{ 
                    padding: '8px 12px', 
                    background: '#f6ffed', 
                    border: '1px solid #b7eb8f', 
                    borderRadius: '8px',
                    cursor: 'pointer',
                    color: '#389e0d',
                    fontSize: '14px'
                  }}>
                    "{prompt}"
                  </div>
                ))}
              </div>
            </Card>
          </Col>

        </Row>
      </Content>
    </Layout>
  );
};

export default Homepage;