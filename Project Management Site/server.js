const express = require("express")
const app = express()
app.set("view engine", "ejs")
app.use(express.urlencoded({extended: false}))
app.use(express.static("public"))

app.get("/", (req, res) => {
    res.render("homepage")
})

app.get("/about", (req, res) => {
    res.render("about")
})

app.get("/signup", (req, res) => {
    res.render("signup")
})

app.listen(3000)