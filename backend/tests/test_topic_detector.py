"""
Script de verificación del TopicDetectorService — ISTQB Study Agent.

Este script NO usa pytest (se instalará en guías futuras). En su lugar,
usa aserciones simples de Python para validar el comportamiento del
topic detector contra el fixture de texto del syllabus.

Ejecución:
    cd backend
    .\\venv\\Scripts\\Activate.ps1
    python -m tests.test_topic_detector

Salida esperada:
    ✅ Test 1 PASÓ: Se detectaron tópicos (59 encontrados)
    ✅ Test 2 PASÓ: Distribución K correcta
    ✅ Test 3 PASÓ: FL-1.1.1 detectado con K1
    ✅ Test 4 PASÓ: FL-4.2.1 detectado con K3
    ✅ Test 5 PASÓ: Cada tópico tiene texto no vacío
    ✅ Test 6 PASÓ: Detección completa (is_complete=True)
    ✅ Test 7 PASÓ: Texto vacío retorna 0 tópicos
    ✅ Test 8 PASÓ: Deduplicación funciona correctamente
    ══════════════════════════════════════════
    ✅ TODOS LOS TESTS PASARON (8/8)
"""

import sys

# Agregar el directorio backend al path para poder importar módulos
# sin necesidad de instalar el paquete.
sys.path.insert(0, ".")

from app.services.topic_detector import TopicDetectorService
from tests.fixtures.sample_syllabus_text import (EXPECTED_TOPIC_CODES,
                                                 SAMPLE_SYLLABUS_TEXT)


def main() -> None:
    """Ejecuta todos los tests de verificación."""
    service = TopicDetectorService()
    passed = 0
    total = 0

    # ─── Test 1: Detección básica ───
    total += 1
    result = service.detect(SAMPLE_SYLLABUS_TEXT)
    try:
        assert result.total_topics > 0, (
            f"Se esperaban tópicos pero se encontraron {result.total_topics}"
        )
        print(f"✅ Test 1 PASÓ: Se detectaron tópicos ({result.total_topics} encontrados)")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 1 FALLÓ: {e}")

    # ─── Test 2: Distribución K ───
    total += 1
    try:
        assert result.level_distribution.get("K1", 0) > 0, "No se encontraron tópicos K1"
        assert result.level_distribution.get("K2", 0) > 0, "No se encontraron tópicos K2"
        assert result.level_distribution.get("K3", 0) > 0, "No se encontraron tópicos K3"
        k_total = sum(result.level_distribution.values())
        assert k_total == result.total_topics, (
            f"Suma de distribución K ({k_total}) != total_topics ({result.total_topics})"
        )
        print(
            f"✅ Test 2 PASÓ: Distribución K correcta "
            f"(K1={result.level_distribution['K1']}, "
            f"K2={result.level_distribution['K2']}, "
            f"K3={result.level_distribution['K3']})"
        )
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 2 FALLÓ: {e}")

    # ─── Test 3: Tópico específico K1 ───
    total += 1
    topic_map = {t.code: t for t in result.topics}
    try:
        assert "FL-1.1.1" in topic_map, "FL-1.1.1 no fue detectado"
        fl_111 = topic_map["FL-1.1.1"]
        assert fl_111.level_k == "K1", (
            f"FL-1.1.1 debería ser K1 pero es {fl_111.level_k}"
        )
        assert "Identify" in fl_111.name, (
            f"Nombre de FL-1.1.1 no contiene 'Identify': {fl_111.name}"
        )
        print(f"✅ Test 3 PASÓ: FL-1.1.1 detectado con K1 — '{fl_111.name}'")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 3 FALLÓ: {e}")

    # ─── Test 4: Tópico específico K3 ───
    total += 1
    try:
        assert "FL-4.2.1" in topic_map, "FL-4.2.1 no fue detectado"
        fl_421 = topic_map["FL-4.2.1"]
        assert fl_421.level_k == "K3", (
            f"FL-4.2.1 debería ser K3 pero es {fl_421.level_k}"
        )
        print(f"✅ Test 4 PASÓ: FL-4.2.1 detectado con K3 — '{fl_421.name}'")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 4 FALLÓ: {e}")

    # ─── Test 5: Texto no vacío ───
    total += 1
    try:
        empty_topics = [t for t in result.topics if len(t.text.strip()) < 10]
        assert len(empty_topics) == 0, (
            f"{len(empty_topics)} tópicos tienen texto vacío o muy corto: "
            f"{[t.code for t in empty_topics]}"
        )
        print("✅ Test 5 PASÓ: Cada tópico tiene texto no vacío")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 5 FALLÓ: {e}")

    # ─── Test 6: Completitud ───
    total += 1
    try:
        # El fixture tiene los 59 tópicos, así que debería ser completo
        assert result.is_complete, (
            f"La detección no es completa. Total: {result.total_topics}, "
            f"Warnings: {result.warnings}"
        )
        print(f"✅ Test 6 PASÓ: Detección completa (is_complete=True)")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 6 FALLÓ: {e}")

    # ─── Test 7: Texto vacío ───
    total += 1
    try:
        empty_result = service.detect("")
        assert empty_result.total_topics == 0, (
            f"Texto vacío debería dar 0 tópicos, dio {empty_result.total_topics}"
        )
        assert not empty_result.is_complete, "Texto vacío no debería ser completo"
        assert len(empty_result.warnings) > 0, "Texto vacío debería generar warnings"
        print("✅ Test 7 PASÓ: Texto vacío retorna 0 tópicos")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 7 FALLÓ: {e}")

    # ─── Test 8: Deduplicación ───
    total += 1
    try:
        # Crear texto con un tópico duplicado
        duplicate_text = (
            "FL-1.1.1 (K1) Identify Typical Test Objectives\n"
            "Testing has different objectives.\n\n"
            "FL-1.1.1 (K1) Identify Typical Test Objectives\n"
            "This is a duplicate entry with more text that appears later "
            "in the document, usually in the body of the chapter.\n\n"
            "FL-1.1.2 (K2) Differentiate Testing from Debugging\n"
            "Testing can trigger failures.\n"
        )
        dup_service = TopicDetectorService(
            expected_topics=["FL-1.1.1", "FL-1.1.2"],
        )
        dup_result = dup_service.detect(duplicate_text)
        codes = [t.code for t in dup_result.topics]
        assert codes.count("FL-1.1.1") == 1, (
            f"FL-1.1.1 aparece {codes.count('FL-1.1.1')} veces (esperada: 1)"
        )
        # Verificar que se mantuvo el texto más largo
        fl111 = next(t for t in dup_result.topics if t.code == "FL-1.1.1")
        assert "duplicate" in fl111.text.lower() or "more text" in fl111.text.lower(), (
            "Se debería haber mantenido la versión con texto más largo"
        )
        print("✅ Test 8 PASÓ: Deduplicación funciona correctamente")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 8 FALLÓ: {e}")

    # ─── Resumen ───
    print("═" * 50)
    if passed == total:
        print(f"✅ TODOS LOS TESTS PASARON ({passed}/{total})")
    else:
        print(f"⚠️ {passed}/{total} tests pasaron — revisa los fallos arriba")
        sys.exit(1)

    # ─── Info adicional ───
    print(f"\n📊 Resumen de detección:")
    print(f"   Tópicos detectados: {result.total_topics}")
    print(f"   Distribución K: {result.level_distribution}")
    print(f"   Completo: {result.is_complete}")
    if result.warnings:
        print(f"   Warnings: {len(result.warnings)}")
        for w in result.warnings:
            print(f"     ⚠️ {w}")


if __name__ == "__main__":
    main()