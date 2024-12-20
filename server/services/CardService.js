const ApiError = require('../exceptions/ApiError')
const {Adress, Card, Char, Residents, Violations, CardViol} = require('../models/models')
const { Op } = require('sequelize');
const sequelize = require('../models/sequelize');

class CardService { 
 
  async add(
    creationDate, inspectionDeadline, responsibleWorker, otherInfo, city, street, home, apartment, homeType, category, owner) { 
  // if (!city) {
  //   throw ApiError.BadRequest('Поле "Город" является обязательным!')
  // }
  // if (!street) {
  //   throw ApiError.BadRequest('Поле "Улица" является обязательным!')
  // }
  // if (!home) {
  //   throw ApiError.BadRequest('Поле "Дом" является обязательным!')
  // }
  // const iscard = await Card.findOne({where:{creationDate:creationDate, city:city, street:street, home:home, apartment:apartment}})
  // if (iscard) { 
  //   throw ApiError.BadRequest('Карточка с таким адресом уже существует!') 
  // }
  const card = await Card.create({
    creationDate, inspectionDeadline, responsibleWorker, otherInfo, category,
    adress: { city, street, home, apartment },
    char: { homeType, owner },
  }, {include: [
    { model: Char },
    { model: Adress },
    ]
  }
  )
    return { card }
  }

  async addArray(num, creationDate, inspectionDeadline, responsibleWorker, otherInfo, city, street, home, apartment, homeType, category, owner) {
    const cards = [];
    for (let i = 0; i < num; i++) {
      const card = await Card.create({
        num: i + 1,
        creationDate,
        inspectionDeadline,
        responsibleWorker,
        otherInfo,
        category,
        adress: { city, street, home, apartment },
        char: { homeType, owner },
      }, {
        include: [
          { model: Char },
          { model: Adress },
        ]
      });
      cards.push(card);
    }
    return { cards };
  }

  async fill(id, rooms, APIs, faultyAPIs, noBatteryAPIs, ovens, faultyOvens, repairNeededOvens, residents, violationIds, changeStatus, fillDate) { 
    const char = await Char.findOne({where:{id:id}})
    Object.assign(char, {
      rooms,
      APIs,
      faultyAPIs,
      noBatteryAPIs,
      ovens,
      faultyOvens,
      repairNeededOvens
    })
    await char.save()
    await Residents.bulkCreate(residents.map((resident) => ({ 
      name: resident.name, 
      surname: resident.surname, 
      paternity: resident.paternity, 
      birth: resident.birth, 
      cardId: id 
    })));
    const card = await Card.findOne({where:{id:id}})
    const violations = await Violations.findAll({ where: { id: { [Op.in]: violationIds } } });
    await card.addViolations(violations);
    await Card.update(
      { 
        status: changeStatus,
        inspectionDate: fillDate,
      },
      { where: { id: id } }
    );    return card
    }

  async createViol(name, description) {
    const viola = await Violations.create({name, description}) 
    return viola
  }

  async destroy(id) { 
    console.log(id)
    const iscard = await Card.findOne({where:{id:id}})
    if (!iscard) { throw new Error ('Карточка по заданному номеру не была найдена!')}
    const card = await Card.destroy({where:{id:id}})
    await Adress.destroy({where:{id:id}})
    await Char.destroy({where:{id:id}})
    await Residents.destroy({where:{id:id}})
    await CardViol.destroy({where:{cardId:id}})
    console.log(card)                                       // в будущем переписать с использованием транзакций, пакетного удаления, проверки связных записей
    return card
  }

  async change(id, param, value) { 
    const card = await Card.findOne({where:{id:id}})
    card[param] = value
    await card.save()
    return card
  }

  async findAll() {
    const cards = await Card.findAll({include: [
      { model: Char },
      { model: Adress },
      { model: Residents },
      { model: Violations}
      ]
    })
    return cards
  }

  async findOne(id) {
    const card = await Card.findOne({
      where:{id:id},
      include: Adress
    })
    return {card}
  }

  async fetchViolations() { 
    const violations = await Violations.findAll()
    return violations
  }

  async addViolationVariant(name, description) { 
    const addedViolation = await Violations.create({name, description});
    return addedViolation
  }

  async updateResponsibleWorker(oldNickname, newNickname) {
    try {
        const [updatedCount] = await Card.update(
            { responsibleWorker: newNickname },
            { where: { responsibleWorker: oldNickname } }
        );
    } catch (error) {
        throw ApiError.BadRequest(`Ошибка при обновлении ответственного работника: ${error.message}`);
    }
}
}

module.exports = new CardService()