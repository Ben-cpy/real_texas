<template>
  <div class="login">
    <div class="login-container">
      <div class="login-card card">
        <h2 class="login-title">欢迎登录</h2>
        
        <el-form :model="loginForm" :rules="rules" ref="loginFormRef" class="login-form">
          <el-form-item prop="username">
            <el-input
              v-model="loginForm.username"
              placeholder="请输入用户名"
              size="large"
              prefix-icon="User"
            />
          </el-form-item>
          
          <el-form-item prop="password">
            <el-input
              v-model="loginForm.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              prefix-icon="Lock"
              show-password
            />
          </el-form-item>
          
          <el-form-item>
            <el-button
              type="primary"
              size="large"
              style="width: 100%"
              :loading="loading"
              @click="handleLogin"
            >
              登录
            </el-button>
          </el-form-item>
        </el-form>
        
        <div class="login-footer">
          <p>还没有账号？<a href="#" @click="showRegister = true">立即注册</a></p>
        </div>
      </div>
    </div>
    
    <!-- 注册对话框 -->
    <el-dialog v-model="showRegister" title="用户注册" width="400px">
      <el-form :model="registerForm" :rules="registerRules" ref="registerFormRef">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="registerForm.username" placeholder="请输入用户名" />
        </el-form-item>
        
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="registerForm.password"
            type="password"
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>
        
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            show-password
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showRegister = false">取消</el-button>
          <el-button type="primary" @click="handleRegister" :loading="registerLoading">
            注册
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const registerLoading = ref(false)
const showRegister = ref(false)
const loginFormRef = ref()
const registerFormRef = ref()

const loginForm = reactive({
  username: '',
  password: ''
})

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 个字符', trigger: 'blur' }
  ]
}

const validateConfirmPassword = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== registerForm.password) {
    callback(new Error('两次输入密码不一致'))
  } else {
    callback()
  }
}

const registerRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate((valid) => {
    if (valid) {
      login()
    }
  })
}

const login = async () => {
  loading.value = true

  try {
    const result = await userStore.login(loginForm.username, loginForm.password)

    if (result.success) {
      ElMessage.success(result.message || '登录成功！')
      router.push('/')
    } else {
      ElMessage.error(result.error || '登录失败')
    }
  } catch (error) {
    ElMessage.error('登录失败，请检查用户名和密码')
  } finally {
    loading.value = false
  }
}

const handleRegister = async () => {
  if (!registerFormRef.value) return
  
  await registerFormRef.value.validate((valid) => {
    if (valid) {
      register()
    }
  })
}

const register = async () => {
  registerLoading.value = true

  try {
    const result = await userStore.register(registerForm.username, registerForm.password)

    if (result.success) {
      ElMessage.success(result.message || '注册成功！正在登录...')
      showRegister.value = false

      // User is automatically logged in after registration
      router.push('/')
    } else {
      ElMessage.error(result.error || '注册失败')
    }
  } catch (error) {
    ElMessage.error('注册失败，请稍后重试')
  } finally {
    registerLoading.value = false
  }
}
</script>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f1419 0%, #1a2332 100%);
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: 20px;
}

.login-card {
  padding: 40px;
  text-align: center;
}

.login-title {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.login-form {
  margin-bottom: 20px;
}

.login-footer {
  margin-top: 20px;
}

.login-footer p {
  color: #ccc;
  font-size: 0.9rem;
}

.login-footer a {
  color: #667eea;
  text-decoration: none;
  cursor: pointer;
}

.login-footer a:hover {
  text-decoration: underline;
}

.login-card :deep(.el-input__inner) {
  background-color: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff !important;
  -webkit-text-fill-color: #fff !important;
}

.login-card :deep(.el-input__inner::placeholder) {
  color: rgba(204, 204, 204, 0.6);
  -webkit-text-fill-color: rgba(204, 204, 204, 0.6);
}

.login-card :deep(.el-input__inner:-webkit-autofill),
.login-card :deep(.el-input__inner:-webkit-autofill:hover),
.login-card :deep(.el-input__inner:-webkit-autofill:focus),
.login-card :deep(.el-input__inner:-webkit-autofill:active) {
  -webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.1) inset !important;
  -webkit-text-fill-color: #fff !important;
  color: #fff !important;
  transition: background-color 5000s ease-in-out 0s;
}

.login-card :deep(.el-input__prefix) {
  color: #ccc;
}

.login-card :deep(.el-button--primary) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.login-card :deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #7b8af0 0%, #8558b8 100%);
}
</style>
