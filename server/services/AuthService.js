const {User} = require('../models/models')
const bcrypt = require('bcrypt')
const uuid = require('uuid')
const mailService = require('./MailService')
const tokenService = require('./TokenService')
const UserDto = require('../dtos/UserDto')
const ApiError = require('../exceptions/ApiError')
const gMailService = require('./gmailService')
const CardService = require('./CardService')
class AuthService { 

  async registration(email, password, nickname) { 
    
    const candidate = await User.findOne({where:{email:email}})
    if (candidate) throw ApiError.BadRequest(`Пользователь с почтовым адресом ${email} уже существует`)

    const activationLink = uuid.v4()
    try { 
      await mailService.sendActivationMail(email, `${process.env.API_URL}/auth/activate/${activationLink}`)
    } catch(e) { 
      throw ApiError.BadRequest(`Не удаётся отправить сообщение на почту ${email}. Проверьте правильность введённых данных`)
    }

    const hashPassword = await bcrypt.hash(password, 5)

    const user = await User.create({email, password:hashPassword, nickname, activationLink})  
    const userDto = new UserDto(user)
    const tokens = tokenService.generateTokens({...userDto})
    await tokenService.saveToken(userDto.id, tokens.refreshToken)
    return { ...tokens, user:userDto }
  }

  async activate(activationLink) { 
    const user = await User.findOne({where:{activationLink}})
    user.isActivated = true
    await user.save()
  }

  async login(email, password) { 
    const user = await User.findOne({where:{email:email}})
    if(!user) { 
        throw ApiError.BadRequest('Пользователь с таким email не найден')
    }
    const isPassEquals = await bcrypt.compare(password, user.password)
    if(!isPassEquals) { 
        throw ApiError.BadRequest('Неверный пароль')
    }
    const userDto = new UserDto(user)
    const tokens = tokenService.generateTokens({...userDto})
    await tokenService.saveToken(userDto.id, tokens.refreshToken)
    return { 
        ...tokens, 
        user: userDto
    }
  }
  
  async logout(refreshToken) { 
    const token = await tokenService.removeToken(refreshToken)
    return token
  }

  async refresh(refreshToken) { 
    if(!refreshToken) { 
        throw ApiError.UnauthorizedError(`В запросе не найден токен`)
    }
    const userData = tokenService.validateRefreshToken(refreshToken)
    const tokenFromDb = tokenService.findToken(refreshToken)
    if(!userData || !tokenFromDb) { 
        throw ApiError.UnauthorizedError('Не найдены токены из userdata либо БД')
    }
    console.log(userData)
    const userId = userData.id
    console.log(userData.id)
    const user = await User.findByPk(userId)
    const userDto = new UserDto(user)
    const tokens = tokenService.generateTokens({...userDto})
    await tokenService.saveToken(userDto.id, tokens.refreshToken)
    return { 
        ...tokens, 
        user: userDto
    }
  }

  async sendMail(email) {
    const user = await User.findOne({where:{email:email}})
    if(user.isActivated) throw ApiError.EmailError()
    const mailTemplate = user.dataValues.email
    const activationLink = user.dataValues.activationLink
    console.log(activationLink)
    if(mailTemplate.includes('@mail.ru')) {
        await mailService.sendActivationMail(email, `${process.env.API_URL}/auth/activate/${activationLink}`)
    }
    if(mailTemplate.includes('@gmail.com')) {
        await gMailService.sendActivationMail(email, `${process.env.API_URL}/auth/activate/${activationLink}`)
    }
    return `Ссылка для активации аккаунта была отправлена на почту ${email}`
  }

  async updateNickname(email, oldNickname, newNickname) { 
    const isNickInUse = await User.findOne({ where: { nickname: newNickname } });    
    if (isNickInUse) {throw ApiError.BadRequest(`Никнейм ${newNickname} уже используется!`)}
    const user = await User.findOne({ where: { email: email } });
    if (!user) {throw ApiError.BadRequest(`Пользователь ${email} почему-то не найден!`)}
    console.log(oldNickname)
    await CardService.updateResponsibleWorker(oldNickname, newNickname)
    user.nickname = newNickname;
    await user.save();
    return { user: user };
  }

  async updateEmail(email, newEmail) { 
    const isEmailInUse = await User.findOne({where:{email:newEmail}})
    if (isEmailInUse) throw ApiError.BadRequest(`Пользователь с почтовым адресом ${email} уже существует`)
    const user = await User.findOne({where:{email:email}})
    if(!user) {throw ApiError.BadRequest(`Пользователь с почтовым адресом ${email} не существует`)}
    const activationLink = uuid.v4()
    try { 
      await mailService.sendActivationMail(email, `${process.env.API_URL}/auth/activate/${activationLink}`)
      user.email = newEmail
      user.isActivated = false
      user.activationLink = activationLink
      await user.save()
    } catch(e) {
      throw ApiError.BadRequest(`Не удаётся отправить сообщение на почту ${email}. Проверьте правильность введённых данных`)
    } finally { 
      return {user:user}
    }

  }
  async changePassword(email, oldPassword, newPassword, confirmPassword) { 
    const user = await User.findOne({where:{email:email}})
    if(!user) {throw ApiError.BadRequest(`Пользователь с почтовым адресом ${email} не существует`)}
    if(newPassword != confirmPassword) {throw ApiError.BadRequest('Новый и подтверждающий пароли не совпадают')}
    const isPassEquals = await bcrypt.compare(oldPassword, user.password)
    if(!isPassEquals) {throw ApiError.BadRequest('Текущий пароль введён неверно!')}

    const newHashedPassword = await bcrypt.hash(newPassword, 5)
    user.password = newHashedPassword
    await user.save()

    const userDto = new UserDto(user)
    const tokens = tokenService.generateTokens({...userDto})
    await tokenService.saveToken(userDto.id, tokens.refreshToken)
    return { 
        ...tokens, 
        user: userDto
    }
  }
  
  async getUsers() { 
    const users = await User.findAll()
    return users
  }

}

module.exports = new AuthService()