import { useContext } from "react";
import CartContext from "./CartContextValue.js";

export const useCart = () => useContext(CartContext);
