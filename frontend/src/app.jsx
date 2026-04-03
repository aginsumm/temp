import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import ChatPage from "./pages/Chat";
import Homepage from "./pages/Homepage";
import KnowledgePage from "./pages/Knowledge";
import User from "./pages/User";
import Login from "./pages/Login";       // 引入登录页
import Register from "./pages/Register"; // 引入注册页

// --- 核心：定义一个路由守卫组件 ---
// 它的作用是：检查有没有 token，如果有就正常渲染页面，没有就强制跳转到 /login
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    // replace 属性表示替换历史记录，这样用户按浏览器返回键就不会再跳回需要登录的空页面
    return <Navigate to="/login" replace />; 
  }
  
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. 登录和注册通常不需要顶部的导航栏，所以放在 MainLayout 的外面 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 2. 主体业务页面，带有 Header 导航栏 */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Homepage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:sessionId" element={<ChatPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          
          {/* 3. 使用路由守卫包裹需要登录才能查看的页面 */}
          <Route 
            path="user" 
            element={
              <PrivateRoute>
                <User />
              </PrivateRoute>
            } 
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}