const express = require("express")
const cors = require("cors")
const mysql = require("mysql2")
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken")

const app = express()

const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, SECRET_KEY } = process.env

app.use(cors())
app.use(express.json())
app.use(bodyParser.json());


app.post("/register", (request, response) => {
    const user = request.body.user

    const searchCommand = `
        SELECT * FROM Users
        WHERE email = ?
    `

    db.query(searchCommand, [user.email], (error, data) => {
        if(error) {
            console.log(error)
            return
        }

        if(data.length !== 0) {
            response.json({ message: "Já existe um usuário cadastrado nesse e-mail. Tente outro e-mail!", userExists: true })
            return
        }

        const insertCommand = `
            INSERT INTO Users(name, email, password)
            VALUES (?, ?, ?)
        `

        db.query(insertCommand, [user.name, user.email, user.password], (error) => {
            if(error) {
                console.log(error)
                return
            }

            response.json({ message: "Usuário cadastrado com sucesso!" })
        })
    })
})

app.post("/login" , (request, response) => {
    const user = request.body.user

    const searchCommand = `
        SELECT * FROM Users
        WHERE email = ?
    `

    db.query(searchCommand, [user.email], (error, data) => {
        if(error) {
            console.log(error)
            return
        }

        if(data.length === 0){
            response.json({ message: "Não existe nenhum usuário cadastrado com esse e-mail" })
            return
        }

        if(user.password === data[0].password){
            const email = user.email
            const id = data[0].id
            const name = data[0].name

            const token = jwt.sign({ id, email, name }, SECRET_KEY, { expiresIn: "1h" })
            response.json({ token, ok: true })
            return
        }

        response.json({ message: "Credenciais inválidas! Tente novamente" })
    })
})

app.get("/verify", (request, response) => {
    const token = request.headers.authorization

    jwt.verify(token, SECRET_KEY, (error, decoded) => {
        if(error) {
            response.json({ message: "Token inválido! Efetue o login novamente." })
            return
        }

        response.json({ ok: true })
    })
})

app.get("/getname", (request, response) => {
    const token = request.headers.authorization

    const decoded = jwt.verify(token, SECRET_KEY) 
        
    response.json({ name: decoded.name })
})



app.post("/ranking", (request, response) => {
    const token = request.headers.authorization;

    try {
        const decoded = jwt.verify(token, SECRET_KEY); // Decodifica o token para obter o nome do usuário
        const { score } = request.body;

        if (typeof score !== "number") {
            response.status(400).json({ message: "Pontuação inválida!" });
            return;
        }

        const searchCommand = `
            SELECT * FROM ranking
            WHERE name = ?
        `

        db.query(searchCommand, [decoded.name], (error, results) => {
            if (error) {
                console.error("Erro ao buscar ranking:", error);
                response.status(500).json({ message: "Erro no servidor" });
                return;
            }

            if (results.length > 0) {
                // Atualizar pontuação existente se a nova for maior
                const updateCommand = `
                    UPDATE ranking
                    SET score = GREATEST(score, ?)
                    WHERE name = ?
                `

                db.query(updateCommand, [score, decoded.name], (error) => {
                    if (error) {
                        console.error("Erro ao atualizar pontuação:", error);
                        response.status(500).json({ message: "Erro no servidor" });
                        return;
                    }

                    response.json({ message: "Pontuação atualizada com sucesso!" });
                });
            } else {
                // Inserir nova pontuação
                const insertCommand = `
                    INSERT INTO ranking (name, score)
                    VALUES (?, ?)
                `

                db.query(insertCommand, [decoded.name, score], (error) => {
                    if (error) {
                        console.error("Erro ao salvar pontuação:", error);
                        response.status(500).json({ message: "Erro no servidor" });
                        return;
                    }

                    response.json({ message: "Pontuação registrada com sucesso!" });
                });
            }
        });
    } catch (error) {
        console.error("Erro de autenticação:", error);
        response.status(401).json({ message: "Token inválido ou expirado!" });
    }
});

app.get("/ranking", (request, response) => {
    const query = `
        SELECT name, score
        FROM ranking
        ORDER BY score DESC
        LIMIT 3
    `

    db.query(query, (error, results) => {
        if (error) {
            console.error("Erro ao buscar ranking:", error);
            response.status(500).json({ message: "Erro no servidor" });
            return;
        }

        response.json(results);
    });
});


app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000!")
})

const db = mysql.createPool ({
    connectionLimit: 10,
    host: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD
})