//------------------------SERVERSETUP------------------------//
require("dotenv").config()
const express = require("express")
const app = express()
const jwt = require("jsonwebtoken")
const bcrypt = require("bcrypt")
const cookieParser = require("cookie-parser")
const db = require("better-sqlite3")("ProjectManagement.db")
db.pragma("journal_mode = WAL")
app.set("view engine", "ejs")
app.use(express.urlencoded({extended: true}))
app.use(express.static("public"))
app.use(cookieParser())

//Creating a few tables, users, projects, and tasks
//I later updated some of these tables with an extra column or two
const createTables = db.transaction(() => {
    db.prepare(
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username STRING NOT NULL UNIQUE,
            password STRING NOT NULL
        )
         `
    ).run()

    db.prepare(
        `CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username STRING NOT NULL,
            title STRING NOT NULL,
            desc STRING
        )
        `
    ).run()
    
    db.prepare(
        `CREATE TABLE IF NOT EXISTS tasks (
            taskid INTEGER PRIMARY KEY AUTOINCREMENT,
            projectid INTEGER,
            title STRING NOT NULL,
            description STRING
        )`
    ).run()
   
})

createTables()
//------------------------SERVERSETUP------------------------//

//------------------------MIDDLEWARE------------------------//
//Middleware here, mainly used to verify the user that is logged in
app.use(function (req, res, next){
    res.locals.errors = []
    if(req.params.id) {
        const statement = db.prepare("SELECT * FROM projects WHERE id = ?")
        const project = statement.get(req.params.id)
        res.locals.project = project
    }
    try {
        //Decoding incoming web token
        const decoded = jwt.verify(req.cookies.UserCookie, process.env.JWTSECRET)
        req.user = decoded
    }
    catch(err) {
        req.user = false
    }
    //Use req.user across website to verify user is logged in
    res.locals.user = req.user
    next()
})
//Middleware function I use to check if user is signed in
function mustBeLoggedIn(req, res, next) { 
    if (req.user) { 
        return next()
    }
    return res.redirect("/")
}
//------------------------MIDDLEWARE------------------------//

//------------------------GETS------------------------//

//Get and render homepage
app.get("/", (req, res) => {
    res.render("homepage")
})
//Get and render about page
app.get("/about", (req, res) => {
    res.render("about")
})
//Get and render login page
app.get("/login", (req, res) => {
    res.render("login")
})
//Get and render logout page
app.get("/logout", (req, res) => {
    res.clearCookie("UserCookie")
    res.redirect("/")
})
//Get and render signup page
app.get("/signup", (req, res) => {
    res.render("signup")
})
//Gets and renders create project page
app.get("/createproject", mustBeLoggedIn, (req, res) => {
    res.render("createproject")
})
//Gets and renders userpage
app.get("/userpage", mustBeLoggedIn, (req, res) => {
    //Finds projects that matches your username
    const getprojectsstatement = db.prepare("SELECT * FROM projects WHERE username = ?")
    const getprojects = getprojectsstatement.all(req.user.username)
    res.render("userpage", { getprojects })
})
//Gets and renders features page
app.get("/features", (req, res) => {
    res.render("features")
})
//Gets projectpage, gets it from the dynamic url here
app.get("/project/:id", mustBeLoggedIn, (req, res) => {
    
    const statement = db.prepare("SELECT * FROM projects WHERE id = ?")
    const project = statement.get(req.params.id)
    //If project doesn't exist, return to home 
    if(!project){
        return res.redirect("/")
    }
    const gettasksstatement = db.prepare("SELECT * FROM tasks WHERE projectid = ?")
    const gettasks = gettasksstatement.all(req.params.id)
    if(!gettasks){
        return res.render("userpage")
    }    
    res.render("projectpage", { project , gettasks })
})
//Gets and renders the edittask page
app.get("/project/:projectid/edit-task/:id", mustBeLoggedIn, (req, res) => {
    
    const gettasksstatement = db.prepare("SELECT * FROM tasks WHERE projectid = ?")
    const gettasks = gettasksstatement.all(req.params.projectid)
    
    const statement = db.prepare("SELECT * FROM projects WHERE id = ?")
    const project = statement.get(req.params.projectid)

    const gettaskineditstate = db.prepare("SELECT * FROM tasks WHERE taskid = ?")
    const gettaskinedit = gettaskineditstate.get(req.params.id)

    //Finds projects, tasks, and the task in edit state and sends it to projectpage
    res.render("projectpage", { project, gettasks, gettaskinedit } )
    
})
//Gets and renders project and its tasks
app.get("/project/:projectid/complete-task/:id", mustBeLoggedIn, (req, res) => {
    const statement = db.prepare("SELECT * FROM projects WHERE id = ?")
    const project = statement.get(req.params.projectid)

    const getcompletedtaskstate = db.prepare("UPDATE tasks SET completed = 1 WHERE taskid = ?")
    const completetaskstate = getcompletedtaskstate.run(req.params.id)

    res.redirect(`/project/${project.id}`)
})
//Gets and renders projectedit
app.get("/edit-project/:projectid", mustBeLoggedIn, (req, res) => {
    const getprojectineditstate = db.prepare("SELECT * FROM projects WHERE id = ?")
    const getprojectinedit = getprojectineditstate.get(req.params.projectid) ||  null
    
    const getprojectsstatement = db.prepare("SELECT * FROM projects WHERE username = ?")
    const getprojects = getprojectsstatement.all(req.user.username)
    if(!getprojectinedit){
        res.redirect("userpage")
    }
    else{
        res.render("userpage", {getprojectinedit, getprojects})
    }
})
app.get("/complete-project/:projectid", mustBeLoggedIn, (req, res) => {
    const getcompletedprojectstate = db.prepare("UPDATE projects SET completed = 1 WHERE id = ?")
    const completeproject = getcompletedprojectstate.run(req.params.projectid)
    res.redirect("/userpage")
})
app.get("/uncomplete-project/:projectid", mustBeLoggedIn, (req, res) => {
    const getuncompletedprojectstate = db.prepare("UPDATE projects SET completed = 0 WHERE id = ?")
    const uncompleteproject = getuncompletedprojectstate.run(req.params.projectid)
    res.redirect("/userpage")
})
app.get("/delete-project/:projectid", mustBeLoggedIn, (req, res) => {
    const getprojtodeletestate = db.prepare("DELETE FROM projects WHERE id = ?")
    const deleteproject = getprojtodeletestate.run(req.params.projectid)
    const gettaskstodeletestate = db.prepare("DELETE FROM tasks where projectid = ?")
    const deletetasks = gettaskstodeletestate.run(req.params.projectid)
    res.redirect("/userpage")
})
app.get("/project/:projectid/delete-task/:id", mustBeLoggedIn, (req, res) => {
    const statement = db.prepare("SELECT * FROM projects WHERE id = ?")
    const project = statement.get(req.params.projectid)

    const gettasktodeletestate = db.prepare("DELETE FROM tasks WHERE taskid = ?")
    const gettasktodelete = gettasktodeletestate.run(req.params.id)
    res.redirect(`/project/${project.id}`)
})
app.get("/project/:projectid/uncomplete-task/:id", mustBeLoggedIn, (req, res) => {
    const statement = db.prepare("SELECT * FROM projects WHERE id = ?")
    const project = statement.get(req.params.projectid)

    const getuncompletedtaskstate = db.prepare("UPDATE tasks SET completed = 0 WHERE taskid = ?")
    const uncompletetaskstate = getuncompletedtaskstate.run(req.params.id)
    res.redirect(`/project/${project.id}`)
})
//------------------------GETS------------------------//

//------------------------POSTS------------------------//
//Post for login, taking incoming data and logging user in
app.post("/login", (req, res) => {
    let errors = []
    //If fields are empty, show error
    if(!req.body.username) errors.push("Must provide a username")
    if(!req.body.password) errors.push("Must provide a password")
    if(errors.length) {
        return res.render("login", {errors})
    }
    //Searching username in database, if not exists, show error
    const usersearchstatement = db.prepare("SELECT * FROM users WHERE username = ?")
    const usersearchcheck = usersearchstatement.get(req.body.username)
    if(!usersearchcheck){
        errors = ["Invalid Username / Password"]
        return res.render("login", {errors})
    }
    //Secure password checker, compares what user entered and user in questions password
    const passchecker = bcrypt.compareSync(req.body.password, usersearchcheck.password)
    if(!passchecker){
        errors = ["Invalid Username / Password"]
        return res.render("login", {errors})
    }
    //Give user a cookie when they sign in, 
    const tokenValue = jwt.sign({exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, userid: usersearchcheck.id, username: usersearchcheck.username} , process.env.JWTSECRET)
    res.cookie("UserCookie", tokenValue, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24
    })
    res.redirect("userpage")
})

//POST, saves edits for projects
app.post("/save-edit-project/:projectid", mustBeLoggedIn, (req, res) => {
    const writeprojecteditstate = db.prepare("UPDATE projects SET title = ?, desc = ? WHERE id = ?")
    const wrtieprojectedit = writeprojecteditstate.run(req.body.projecttitle, req.body.projectdesc, req.params.projectid)
    res.redirect("/userpage")
})
app.post("/project/:projectid/save-task-edit/:id", mustBeLoggedIn, (req, res) => {
    const gettasksstatement = db.prepare("SELECT * FROM tasks WHERE projectid = ?")
    const gettasks = gettasksstatement.all(req.params.projectid)
    
    const statement = db.prepare("SELECT * FROM projects WHERE id = ?")
    const project = statement.get(req.params.projectid)
    
    const writetaskeditstate = db.prepare("UPDATE tasks SET title = ?, description = ? WHERE taskid = ?")
    const writetaskedit = writetaskeditstate.run(req.body.tasktitle, req.body.taskdesc, req.params.id)  
    res.redirect(`/project/${project.id}`)
})
app.post("/createtask/:id", mustBeLoggedIn, (req, res) => {
    const errors = []
    if(!req.body.tasktitle) errors.push("Must provide a task title")

    const statement = db.prepare("SELECT * FROM projects WHERE id = ?")
    const project = statement.get(req.params.id)

    const taskstate = db.prepare("INSERT INTO tasks (projectid, title, description) VALUES (?, ?, ?)")
    const addtask = taskstate.run(req.params.id, req.body.tasktitle, req.body.taskdesc)

    const gettasksstatement = db.prepare("SELECT * FROM tasks WHERE projectid = ?")
    const gettasks = gettasksstatement.all(req.params.id)
    res.redirect(`/project/${project.id}`)
})
app.post("/createproject", mustBeLoggedIn, (req, res) => {
    const errors = []
    if(errors.length){
        return res.render("createproject", {errors})
    }
    const projectstate = db.prepare("INSERT INTO projects (username, title, desc) VALUES (?, ?, ?)")
    const addproject = projectstate.run(req.user.username, req.body.projectitle, req.body.projectdesc)

    const getprojectstate = db.prepare("SELECT * FROM projects WHERE ROWID = ?")
    const currentproject = getprojectstate.get(addproject.lastInsertRowid)
    res.redirect(`/project/${currentproject.id}`)
})
app.post("/signup", (req, res) => {
    const errors = []
    //ERROR checking here
    if(!req.body.username) errors.push("Must provide a username")
    if(!req.body.password) errors.push("Must provide a password")

    if(req.body.username && req.body.username.length < 3) errors.push("Username must be between 3 and 20 characters")
    if(req.body.username && req.body.username.length > 20) errors.push("Username must be between 3 and 20 characters")
    if (req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)) errors.push("Username can only contain letters and numbers")

    if(req.body.password && req.body.password.length < 8) errors.push("Password must be at least 8 characters long")
    if (req.body.password && req.body.password.length > 30) errors.push("Password must be less than 30 characters long")
    //Checking to see if username is taken
    const useralreadystatement = db.prepare("SELECT * FROM users WHERE username = ?")
    const useralreadycheck = useralreadystatement.get(req.body.username)
    if(useralreadycheck) errors.push("That username is already taken")
    if(errors.length){
        return res.render("signup", {errors})
    }
    //Encrypting password and putting it into database
    const salt = bcrypt.genSaltSync(10)
    req.body.password = bcrypt.hashSync(req.body.password, salt)
    const adduserstatement = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)")
    const adduser = adduserstatement.run(req.body.username, req.body.password)

    const userlookupstate = db.prepare("SELECT * FROM users WHERE ROWID = ?")
    const currentuser = userlookupstate.get(adduser.lastInsertRowid)
    //Giving user a cookie when they sign up to get started immediately
    const tokenValue = jwt.sign({exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, userid: currentuser.id, username: currentuser.username} , process.env.JWTSECRET)
    res.cookie("UserCookie", tokenValue, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24
    })
    res.redirect("/")
})
//------------------------POSTS------------------------//

app.listen(process.env.PORT || 3000);