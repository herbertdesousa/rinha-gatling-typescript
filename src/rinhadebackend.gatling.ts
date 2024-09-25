import {
  constantUsersPerSec,
  exec,
  getEnvironmentVariable,
  rampUsersPerSec,
  scenario,
  simulation,
  StringBody,
  tsv
} from "@gatling.io/core";
import { header, http, status } from "@gatling.io/http";

export default simulation((setUp) => {
  const httpProtocol = http
    .baseUrl(getEnvironmentVariable("TEST_URL", "http://192.168.15.12"))
    .userAgentHeader("Agente do Caos - 2023");

  const criacaoEConsultaPessoas = scenario("Criação E Talvez Consulta de Pessoas")
    .feed(tsv("pessoas-payloads.tsv").circular())
    .exec(
      http("criação")
        .post("/pessoas")
        .body(StringBody("#{payload}"))
        // 201 pros casos de sucesso :)
        // 422 pra requests inválidos :|
        // 400 pra requests bosta tipo data errada, tipos errados, etc. :(
        .header("content-type", "application/json")
        // Se a criacao foi na api1 e esse location request atingir api2, a api2 tem que encontrar o registro.
        // Pode ser que o request atinga a mesma instancia, mas estatisticamente, pelo menos um request vai atingir a outra.
        // Isso garante o teste de consistencia de dados
        .check(status().in(201, 422, 400))
        .checkIf((session) => (session as any)?.httpStatus === 201)
        .then(header("Location").saveAs("location"))
      // .check(status().in(201.502))
      // .checkIf(session => (session as any)?.httpStatus === 201)
      // .then(session => console.log())
    )
    .pause(1, 30)
    .doIf((session) => session.contains("location"))
    .then(exec(http("consulta").get((session) => (session as any).location)))
    .doIf((session) => session.contains("location"))
    .then(exec(http("http://localhost:3333").post((session) => (session as any).location)));

  const buscaPessoas = scenario("Busca Válida de Pessoas")
    .feed(tsv("termos-busca.tsv").circular())
    .exec(
      http("busca válida").get("/pessoas?t=#{t}")
      // qq resposta na faixa 2XX tá safe
    );

  // Scenario for invalid person search
  const buscaInvalidaPessoas = scenario("Busca Inválida de Pessoas").exec(
    http("busca inválida")
      .get("/pessoas")
      // 400 - bad request se não passar 't' como query string
      .check(status().in(400))
  );

  setUp(
    criacaoEConsultaPessoas.injectOpen(
      constantUsersPerSec(2).during({ amount: 10, unit: "seconds" }), // warm up
      constantUsersPerSec(5).during({ amount: 15, unit: "seconds" }).randomized(), // are you ready?

      rampUsersPerSec(6).to(600).during({ amount: 3, unit: "minutes" }) // lezzz go!!!
    ),
    buscaPessoas.injectOpen(
      constantUsersPerSec(2).during({ amount: 25, unit: "seconds" }), // warm up

      rampUsersPerSec(6).to(100).during({ amount: 3, unit: "minutes" }) // lezzz go!!!
    ),
    buscaInvalidaPessoas.injectOpen(
      constantUsersPerSec(2).during({ amount: 25, unit: "seconds" }), // warm up

      rampUsersPerSec(6).to(40).during({ amount: 3, unit: "minutes" }) // lezzz go!!!
    )
  ).protocols(httpProtocol);
});
