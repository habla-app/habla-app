// Logica atomica de transacciones de Lukas
// REGLA CRITICA: Todo movimiento de Lukas es una transaccion atomica.
// Si falla cualquier paso, se revierte todo.
// El balance NUNCA puede ser negativo — verificar ANTES de descontar.
// TODO: Sprint 2 - Implementar compra, descuento, acreditacion
