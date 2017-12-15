/// Import dependencies
// Electron components
const {ipcRenderer, remote} = require('electron')
const {app} = remote

// Node dependencies
const Mousetrap = require('mousetrap')
const _ = require('lodash')
const json2csv = require('json2csv')
const sanitize = require('sanitize-filename')
const fs = require('fs')
const path = require('path')
const url = require('url')

// Local dependencies
const View = require('./rendererRateImagesView.js')
const Question = require('./question.js')
const Rating = require('./rating.js')

// Helpers
const rateImage = function (question, rating) {
  // Set the rating in the user state
  const questionRatingKey = question + 'Rating'
  userState[questionRatingKey] = rating

  // Check if the next button should be enabled
  if (didAnswerAllQuestions()) {
    View.enableNextButton()
  }
}

const didAnswerAllQuestions = function () {
  if (userState.q1Rating &&
  userState.q2Rating &&
  userState.q3Rating &&
  userState.q4Rating &&
  userState.q5Rating) {
    return true
  } else {
    return false
  }
}

const saveImageRatings = function () {
  const filePath = path.join(savePath, getFileName('.csv'))
  const fields = ['imagePath', 'imageName', 'q1Rating', 'q2Rating', 'q3Rating', 'q4Rating', 'q5Rating']
  const fieldNames = ['Image Path', 'Image Name', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5']
  const imageRatingsClone = _.cloneDeep(imageRatings)
  const data = _.map(imageRatingsClone, imageRating => {
    imageRating.q1Rating = (/r([1-5])/g).exec(imageRating.q1Rating)[1]
    imageRating.q2Rating = (/r([1-5])/g).exec(imageRating.q2Rating)[1]
    imageRating.q3Rating = (/r([1-5])/g).exec(imageRating.q3Rating)[1]
    imageRating.q4Rating = (/r([1-5])/g).exec(imageRating.q4Rating)[1]
    imageRating.q5Rating = (/r([1-5])/g).exec(imageRating.q5Rating)[1]
    return imageRating
  })
  const imageRatingsCSV = json2csv({ data: data, fields: fields, fieldNames: fieldNames })
  fs.writeFile(filePath, imageRatingsCSV, err => {
    if (err) {
      console.error(new Error(err))
    } else {
      // Delete the JSON file
      const jsonFileName = getFileName('.json')
      const jsonFilePath = path.join(app.getPath('appData'), app.getName(), jsonFileName)
      if (fs.existsSync(jsonFilePath)) {
        fs.unlinkSync(jsonFilePath)
      }
    }
  })
}

const loadImageRatings = function (imagesPath) {
  const fileName = getFileName('.json')
  const filePath = path.join(app.getPath('appData'), app.getName(), fileName)
  if (fs.existsSync(filePath)) {
    imageRatings = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } else {
    // Get all .png filePaths
    let fileNames = fs.readdirSync(imagesPath)
    _.remove(fileNames, fileName => {
      return path.extname(fileName) !== '.png'
    })
    // Shuffle the order of the images
    fileNames = _.shuffle(fileNames)

    // Initialize the image ratings
    imageRatings = _.map(fileNames, fileName => {
      const filePath = path.join(imagesPath, fileName)
      return {
        imagePath: filePath,
        imageName: path.basename(filePath, '.png'),
        q1Rating: null,
        q2Rating: null,
        q3Rating: null,
        q4Rating: null,
        q5Rating: null
      }
    })
  }
}

const storeUserState = function () {
  // Copy keys in the user state to the current image rating object
  const i = userState.currentImageRatingIndex
  if (i >= 0 && i < imageRatings.length) {
    Object.keys(userState).forEach(userStateKey => {
      if (imageRatings[i].hasOwnProperty(userStateKey)) {
        imageRatings[i][userStateKey] = userState[userStateKey]
      }
    })
  }
}

const loadUserState = function () {
  // Load the user state from the image rating
  const i = userState.currentImageRatingIndex
  if (i >= 0 && i < imageRatings.length) {
    Object.keys(imageRatings[i]).forEach(imageRatingKey => {
      if (userState.hasOwnProperty(imageRatingKey)) {
        userState[imageRatingKey] = imageRatings[i][imageRatingKey]
      }
    })
  }
}

const updateNavigationButtonsState = function () {
  if (userState.currentImageRatingIndex === imageRatings.length - 1 || !didAnswerAllQuestions()) {
    View.disableNextButton()
  } else {
    View.enableNextButton()
  }

  if (userState.currentImageRatingIndex > 0) {
    View.enablePreviousButton()
  } else {
    View.disablePreviousButton()
  }
}

const loadRatingButtons = function () {
  const questions = [Question.Q1, Question.Q2, Question.Q3, Question.Q4, Question.Q5]

  // Erase all rating button selections
  questions.forEach(question => {
    View.View.clearRatingButtons(question)
  })

  // Load user state rating button selections
  questions.forEach(question => {
    const questionRatingKey = question + 'Rating'
    View.setRatingButton(question, userState[questionRatingKey])
  })
}

const next = function () {
  // Store the user state
  storeUserState()
  // Update the user state for the next image
  userState.currentImageRatingIndex++
  loadUserState()
  loadRatingButtons()
  updateNavigationButtonsState()

  // Get the next image if there is one
  if (userState.currentImageRatingIndex >= 0 && userState.currentImageRatingIndex < imageRatings.length) {
    image.src = imageRatings[userState.currentImageRatingIndex].imagePath
  } else {
    // Save the image ratings to a CSV file
    saveImageRatings()

    // Load the done screen
    remote.getCurrentWindow().loadURL(url.format({
      pathname: path.join(__dirname, 'done.html'),
      protocol: 'file:',
      slashes: true
    }))
  }
}

const previous = function () {
  // Store the user state
  storeUserState()
  // Update the user state for the previous image
  userState.currentImageRatingIndex--
  loadUserState()
  loadRatingButtons()
  updateNavigationButtonsState()

  // Get the previous image
  image.src = imageRatings[userState.currentImageRatingIndex].imagePath
}

/// View
// Image
const image = document.getElementById('image')

/// Model
let imageRatings
let savePath
let name
const userState = {
  currentImageRatingIndex: -1,
  q1Rating: null,
  q2Rating: null,
  q3Rating: null,
  q4Rating: null,
  q5Rating: null
}

const getFileName = function (extension) {
  return 'ImageRatings-' + sanitize(name) + extension
}

const getCurrentQuestion = function () {
  if (userState.q1Rating === null) {
    return Question.Q1
  } else if (userState.q2Rating === null) {
    return Question.Q2
  } else if (userState.q3Rating === null) {
    return Question.Q3
  } else if (userState.q4Rating === null) {
    return Question.Q4
  } else {
    return Question.Q5
  }
}

ipcRenderer.on('Message-Setup', (event, data) => {
  // Set the user's name and initialize the image ratings
  name = data.name
  savePath = data.savePath
  loadImageRatings(data.imagesPath)
  loadUserState()
  loadRatingButtons()

  // Load the first image
  next()
})

/// UI Actions
// Rating buttons
document.querySelectorAll('.button.rating').forEach(ratingButton => {
  const question = _.intersection(ratingButton.classList, [Question.Q1, Question.Q2, Question.Q3, Question.Q4, Question.Q5])[0]
  const rating = _.intersection(ratingButton.classList, [Rating.R1, Rating.R2, Rating.R3, Rating.R4, Rating.R5])[0]
  ratingButton.addEventListener('click', event => {
    // Remove color from all rating buttons for the answered question
    View.View.clearRatingButtons(question)
    // Color the clicked button
    View.setRatingButton(question, rating)
    // Store the rating in the user state
    rateImage(question, rating)
  })
})

// Next button
View.nextButton.addEventListener('click', event => {
  if (View.isNextButtonEnabled()) {
    next()
  }
})

// Previous button
View.previousButton.addEventListener('click', event => {
  if (View.isPreviousButtonEnabled()) {
    previous()
  }
})

// Quit the app
window.addEventListener('unload', event => {
  const fileName = getFileName('.json')
  const filePath = path.join(app.getPath('appData'), app.getName(), fileName)
  fs.writeFile(filePath, JSON.stringify(imageRatings), 'utf8', err => {
    if (err) {
      console.error(new Error(err))
    }
  })
})

// Key bindings for rating buttons
Mousetrap.bind('1', event => {
  // Remove color from all rating buttons for the answered question
  View.View.clearRatingButtons(getCurrentQuestion(), Rating.R1)
  // Color the clicked button
  View.setRatingButton(getCurrentQuestion(), Rating.R1)
  // Store the rating in the user state
  rateImage(getCurrentQuestion(), Rating.R1)
})
Mousetrap.bind('2', event => {
  // Remove color from all rating buttons for the answered question
  View.clearRatingButtons(getCurrentQuestion(), Rating.R2)
  // Color the clicked button
  View.setRatingButton(getCurrentQuestion(), Rating.R2)
  // Store the rating in the user state
  rateImage(getCurrentQuestion(), Rating.R2)
})
Mousetrap.bind('3', event => {
  // Remove color from all rating buttons for the answered question
  View.clearRatingButtons(getCurrentQuestion(), Rating.R3)
  // Color the clicked button
  View.setRatingButton(getCurrentQuestion(), Rating.R3)
  // Store the rating in the user state
  rateImage(getCurrentQuestion(), Rating.R3)
})
Mousetrap.bind('4', event => {
  // Remove color from all rating buttons for the answered question
  View.clearRatingButtons(getCurrentQuestion(), Rating.R4)
  // Color the clicked button
  View.setRatingButton(getCurrentQuestion(), Rating.R4)
  // Store the rating in the user state
  rateImage(getCurrentQuestion(), Rating.R4)
})
Mousetrap.bind('5', event => {
  // Remove color from all rating buttons for the answered question
  View.clearRatingButtons(getCurrentQuestion(), Rating.R5)
  // Color the clicked button
  View.setRatingButton(getCurrentQuestion(), Rating.R5)
  // Store the rating in the user state
  rateImage(getCurrentQuestion(), Rating.R5)
})

Mousetrap.bind(['enter', 'space', 'right', 'n'], event => {
  if (View.isNextButtonEnabled()) {
    next()
  }
})
Mousetrap.bind(['left', 'p'], event => {
  if (View.isPreviousButtonEnabled()) {
    previous()
  }
})
