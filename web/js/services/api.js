// Ponto único de acesso ao backend. As telas importam só daqui.
import { CONFIG } from "../config.js";
import { apiHttp } from "./api-http.js";
import { apiMock } from "./api-mock.js";

export const api = CONFIG.MODO === "api" ? apiHttp : apiMock;
